package de.verdent.djpult.pult;

import org.bukkit.NamespacedKey;
import org.bukkit.plugin.Plugin;

/**
 * The persistent data keys used to mark deck entities and to store their settings. Keeping the
 * whole state on the entity means a deck survives chunk unloads and restarts without the plugin
 * having to maintain a separate data file.
 */
public final class PultKeys {

    public final NamespacedKey marker;
    public final NamespacedKey displayId;
    public final NamespacedKey interactionId;
    public final NamespacedKey owner;
    public final NamespacedKey volume;
    public final NamespacedKey radius;
    public final NamespacedKey loop;
    public final NamespacedKey shuffle;
    public final NamespacedKey song;
    public final NamespacedKey item;

    public PultKeys(Plugin plugin) {
        marker = new NamespacedKey(plugin, "deck");
        displayId = new NamespacedKey(plugin, "display_id");
        interactionId = new NamespacedKey(plugin, "interaction_id");
        owner = new NamespacedKey(plugin, "owner");
        volume = new NamespacedKey(plugin, "volume");
        radius = new NamespacedKey(plugin, "radius");
        loop = new NamespacedKey(plugin, "loop");
        shuffle = new NamespacedKey(plugin, "shuffle");
        song = new NamespacedKey(plugin, "song");
        item = new NamespacedKey(plugin, "deck_item");
    }
}
