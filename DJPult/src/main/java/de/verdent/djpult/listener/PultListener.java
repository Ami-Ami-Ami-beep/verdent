package de.verdent.djpult.listener;

import de.verdent.djpult.DJPultPlugin;
import de.verdent.djpult.pult.DJPult;
import de.verdent.djpult.pult.PultItem;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Entity;
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

    @EventHandler(ignoreCancelled = true)
    public void onPlace(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || event.getHand() != EquipmentSlot.HAND) {
            return;
        }
        ItemStack item = event.getItem();
        if (!PultItem.isPultItem(item, plugin.keys())) {
            return;
        }
        event.setCancelled(true);

        Player player = event.getPlayer();
        if (!player.hasPermission("djpult.place")) {
            player.sendMessage(plugin.pultConfig().message("no-permission-place"));
            return;
        }

        Block clicked = event.getClickedBlock();
        if (clicked == null) {
            return;
        }
        Block target = clicked.getRelative(event.getBlockFace());
        if (!target.isEmpty() && !target.isPassable()) {
            player.sendMessage(plugin.pultConfig().message("no-space"));
            return;
        }

        Location base = target.getLocation().add(0.5, 0, 0.5);
        // Snap to eighth turns and spin around so the deck faces the player who placed it.
        float yaw = Math.round(player.getLocation().getYaw() / 45f) * 45f + 180f;

        plugin.pultManager().place(player, base, yaw);
        if (player.getGameMode() != GameMode.CREATIVE) {
            item.setAmount(item.getAmount() - 1);
        }
        player.sendMessage(plugin.pultConfig().message("placed"));
    }

    @EventHandler(ignoreCancelled = true)
    public void onRightClick(PlayerInteractEntityEvent event) {
        handleInteract(event.getPlayer(), event.getRightClicked(), event.getHand());
    }

    /**
     * Interaction entities usually arrive as the "at" variant, which has its own handler list and
     * would otherwise be missed.
     */
    @EventHandler(ignoreCancelled = true)
    public void onRightClickAt(PlayerInteractAtEntityEvent event) {
        handleInteract(event.getPlayer(), event.getRightClicked(), event.getHand());
    }

    private void handleInteract(Player player, Entity entity, EquipmentSlot hand) {
        if (hand != EquipmentSlot.HAND) {
            return;
        }
        if (!plugin.pultManager().isDeckEntity(entity)) {
            return;
        }
        long now = System.currentTimeMillis();
        Long previous = lastInteraction.get(player.getUniqueId());
        if (previous != null && now - previous < INTERACT_COOLDOWN_MILLIS) {
            return;
        }
        lastInteraction.put(player.getUniqueId(), now);

        plugin.pultManager().fromEntity(entity).ifPresent(pult -> {
            if (player.isSneaking()) {
                tryRemove(player, pult);
            } else {
                plugin.openGui(player, pult);
            }
        });
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
