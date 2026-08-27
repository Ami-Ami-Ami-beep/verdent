package de.verdent.djpult.listener;

import de.verdent.djpult.DJPultPlugin;
import de.verdent.djpult.gui.DJPultGui;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;

/** Keeps the control panel read-only and routes clicks to the GUI. */
public final class GuiListener implements Listener {

    private final DJPultPlugin plugin;

    public GuiListener(DJPultPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof DJPultGui gui)) {
            return;
        }
        // Cancel everything in this view, including shift-clicks out of the player's own inventory.
        event.setCancelled(true);

        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        if (event.getClickedInventory() == null
                || !event.getClickedInventory().equals(event.getView().getTopInventory())) {
            return;
        }
        if (!plugin.mayControl(player, gui.pult())) {
            player.sendMessage(plugin.pultConfig().message("no-permission-control"));
            player.closeInventory();
            return;
        }
        if (!gui.pult().isValid()) {
            player.closeInventory();
            return;
        }
        gui.handleClick(player, event.getSlot());
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getInventory().getHolder() instanceof DJPultGui) {
            event.setCancelled(true);
        }
    }
}
