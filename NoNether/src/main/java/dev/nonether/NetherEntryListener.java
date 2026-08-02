package dev.nonether;

import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityPortalEvent;
import org.bukkit.event.player.PlayerPortalEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Cancels every teleport whose destination is a Nether world. Portals
 * themselves are left alone - they can still be built, lit and walked into,
 * the trip just never happens.
 */
final class NetherEntryListener implements Listener {

    private final NoNetherPlugin plugin;
    private final Map<UUID, Long> lastMessage = new HashMap<>();

    NetherEntryListener(NoNetherPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlayerPortal(PlayerPortalEvent event) {
        if (!leadsToNether(event.getTo())) {
            return;
        }
        if (mayBypass(event.getPlayer())) {
            return;
        }
        event.setCancelled(true);
        notifyBlocked(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlayerTeleport(PlayerTeleportEvent event) {
        // PlayerPortalEvent has its own handler list, but guard anyway in case a
        // proxy or another plugin re-fires the event as its supertype.
        if (event instanceof PlayerPortalEvent) {
            return;
        }
        if (!plugin.settings().blockPluginTeleports()) {
            return;
        }
        if (!leadsToNether(event.getTo()) || leadsToNether(event.getFrom())) {
            return;
        }
        if (mayBypass(event.getPlayer())) {
            return;
        }
        event.setCancelled(true);
        notifyBlocked(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onEntityPortal(EntityPortalEvent event) {
        if (!plugin.settings().blockEntities()) {
            return;
        }
        if (!leadsToNether(event.getTo())) {
            return;
        }
        event.setCancelled(true);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        lastMessage.remove(event.getPlayer().getUniqueId());
    }

    private boolean leadsToNether(@Nullable Location location) {
        if (location == null) {
            return false;
        }
        World world = location.getWorld();
        return world != null && world.getEnvironment() == World.Environment.NETHER;
    }

    private boolean mayBypass(Player player) {
        NoNetherConfig settings = plugin.settings();
        return settings.respectBypassPermission() && player.hasPermission("nonether.bypass");
    }

    private void notifyBlocked(Player player) {
        NoNetherConfig settings = plugin.settings();
        if (!settings.hasMessage()) {
            return;
        }

        long now = System.currentTimeMillis();
        Long previous = lastMessage.get(player.getUniqueId());
        if (previous != null && now - previous < settings.messageCooldownMillis()) {
            return;
        }
        lastMessage.put(player.getUniqueId(), now);

        switch (settings.messageTarget()) {
            case CHAT -> player.sendMessage(settings.message());
            case ACTION_BAR -> player.sendActionBar(settings.message());
            case NONE -> {
            }
        }
    }
}
