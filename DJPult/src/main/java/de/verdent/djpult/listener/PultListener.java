package de.verdent.djpult.listener;

import de.verdent.djpult.DJPultPlugin;
import de.verdent.djpult.pult.DJPult;
import de.verdent.djpult.pult.PartLayout;
import de.verdent.djpult.pult.PultItem;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Interaction;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerInteractAtEntityEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Placing, opening, removing and protecting decks. */
public final class PultListener implements Listener {

    /** Clients send more than one interact packet per click; ignore the echoes. */
    private static final long INTERACT_COOLDOWN_MILLIS = 250;

    private final DJPultPlugin plugin;
    private final Map<UUID, Long> lastInteraction = new HashMap<>();

    public PultListener(DJPultPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onInteractBlock(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || event.getHand() != EquipmentSlot.HAND) {
            return;
        }
        Block clicked = event.getClickedBlock();
        if (clicked == null) {
            return;
        }

        ItemStack item = event.getItem();
        if (PultItem.isPultItem(item, plugin.keys())) {
            event.setCancelled(true);
            place(event.getPlayer(), clicked, event.getBlockFace(), item);
            return;
        }

        // A deck is meant to be clicked through its interaction entity, but the client
        // decides for itself whether it targets that entity or the block it stands in.
        // When it picks the block, no entity event is ever sent, so the deck is opened
        // from here as well.
        deckAt(clicked).ifPresent(pult -> {
            event.setCancelled(true);
            plugin.debug(() -> "block interact on a deck at " + clicked.getType());
            handleDeck(event.getPlayer(), pult);
        });
    }

    /** The deck standing in this block, if there is one. */
    private Optional<DJPult> deckAt(Block block) {
        Location centre = block.getLocation().add(0.5, 0.5, 0.5);
        for (Entity entity : block.getWorld().getNearbyEntities(centre, 0.6, 0.6, 0.6)) {
            if (entity instanceof Interaction && plugin.pultManager().isDeckEntity(entity)) {
                Optional<DJPult> pult = plugin.pultManager().fromEntity(entity);
                if (pult.isPresent()) {
                    return pult;
                }
            }
        }
        return Optional.empty();
    }

    private void place(Player player, Block clicked, BlockFace face, ItemStack item) {
        if (!player.hasPermission("djpult.place")) {
            player.sendMessage(plugin.pultConfig().message("no-permission-place"));
            return;
        }

        Block target = clicked.getRelative(face);
        Location base = target.getLocation().add(0.5, 0, 0.5);
        // Snap to quarter turns and spin around so the deck faces the player who placed it. Quarter
        // turns keep the side parts exactly on block edges.
        float yaw = PartLayout.snapYaw(player.getLocation().getYaw() + 180f);

        // A deck can be several blocks wide, so every part needs room, not just the block clicked.
        if (!plugin.pultManager().canPlace(base, yaw)) {
            player.sendMessage(plugin.pultConfig().message("no-space"));
            return;
        }

        plugin.pultManager().place(player, base, yaw);
        if (player.getGameMode() != GameMode.CREATIVE) {
            item.setAmount(item.getAmount() - 1);
        }
        player.sendMessage(plugin.pultConfig().message("placed"));
    }

    @EventHandler
    public void onRightClick(PlayerInteractEntityEvent event) {
        handleInteract(event.getPlayer(), event.getRightClicked(), event.getHand());
    }

    /**
     * Interaction entities usually arrive as the "at" variant, which has its own handler list and
     * would otherwise be missed.
     */
    // Deliberately without ignoreCancelled: another plugin cancelling the interact
    // would otherwise silently swallow every click on the deck.
    @EventHandler
    public void onRightClickAt(PlayerInteractAtEntityEvent event) {
        handleInteract(event.getPlayer(), event.getRightClicked(), event.getHand());
    }

    private void handleInteract(Player player, Entity entity, EquipmentSlot hand) {
        plugin.debug(() -> "entity interact from " + player.getName() + " on " + entity.getType()
                + " hand=" + hand + " deckEntity=" + plugin.pultManager().isDeckEntity(entity));

        if (hand != EquipmentSlot.HAND || !plugin.pultManager().isDeckEntity(entity)) {
            return;
        }
        plugin.pultManager().fromEntity(entity).ifPresent(pult -> handleDeck(player, pult));
    }

    /** Shared by both routes in, so a click counts once however it arrived. */
    private void handleDeck(Player player, DJPult pult) {
        long now = System.currentTimeMillis();
        Long previous = lastInteraction.get(player.getUniqueId());
        if (previous != null && now - previous < INTERACT_COOLDOWN_MILLIS) {
            return;
        }
        lastInteraction.put(player.getUniqueId(), now);

        if (player.isSneaking()) {
            tryRemove(player, pult);
        } else {
            // Next tick: an inventory opened while the server is still handling the
            // interact packet can be dropped again by the client.
            Bukkit.getScheduler().runTask(plugin, () -> plugin.openGui(player, pult));
        }
    }

    /**
     * Decks must not be destroyed by explosions, fire or stray arrows. A player's own hit is the
     * one case that is turned into a removal instead.
     */
    @EventHandler(ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (!plugin.pultManager().isDeckEntity(event.getEntity())) {
            return;
        }
        event.setCancelled(true);

        if (!(event instanceof EntityDamageByEntityEvent byEntity)
                || !(byEntity.getDamager() instanceof Player player)) {
            return;
        }
        plugin.pultManager().fromEntity(event.getEntity())
                .ifPresent(pult -> tryRemove(player, pult));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        lastInteraction.remove(event.getPlayer().getUniqueId());
    }

    private void tryRemove(Player player, DJPult pult) {
        if (!plugin.mayBreak(player, pult)) {
            player.sendMessage(plugin.pultConfig().message("no-permission-break"));
            return;
        }
        Location location = pult.location();
        plugin.playback().forget(pult);
        plugin.pultManager().remove(pult);

        if (plugin.pultConfig().giveItemBackOnBreak()) {
            ItemStack item = PultItem.create(plugin.pultConfig(), plugin.keys());
            player.getInventory().addItem(item).values()
                    .forEach(leftover -> location.getWorld().dropItemNaturally(location, leftover));
        }
        player.sendMessage(plugin.pultConfig().message("removed"));
    }
}
