package de.verdent.djpult.gui;

import de.verdent.djpult.DJPultPlugin;
import de.verdent.djpult.audio.SongPlayer;
import de.verdent.djpult.config.PultConfig;
import de.verdent.djpult.nbs.Song;
import de.verdent.djpult.pult.DJPult;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The deck's control panel. The inventory is identified by this holder rather than by its title,
 * so a renamed GUI can never be confused with a player's own chest.
 */
public final class DJPultGui implements InventoryHolder {

    private static final int SIZE = 54;
    private static final int SONGS_PER_PAGE = 36;

    private static final int SLOT_PREVIOUS = 36;
    private static final int SLOT_PLAY_PAUSE = 37;
    private static final int SLOT_STOP = 38;
    private static final int SLOT_NEXT = 39;
    private static final int SLOT_INFO = 40;
    private static final int SLOT_LOOP = 41;
    private static final int SLOT_SHUFFLE = 42;

    private static final int SLOT_VOLUME_DOWN = 45;
    private static final int SLOT_VOLUME = 46;
    private static final int SLOT_VOLUME_UP = 47;
    private static final int SLOT_RADIUS_DOWN = 48;
    private static final int SLOT_RADIUS = 49;
    private static final int SLOT_RADIUS_UP = 50;
    private static final int SLOT_PAGE_PREVIOUS = 51;
    private static final int SLOT_PAGE_INFO = 52;
    private static final int SLOT_PAGE_NEXT = 53;

    private static final float VOLUME_STEP = 0.1f;
    private static final double RADIUS_STEP = 4.0;
    private static final int BAR_LENGTH = 20;

    private final DJPultPlugin plugin;
    private final DJPult pult;
    private final Inventory inventory;

    private int page;

    public DJPultGui(DJPultPlugin plugin, DJPult pult) {
        this.plugin = plugin;
        this.pult = pult;
        this.inventory = Bukkit.createInventory(this, SIZE, plugin.pultConfig().guiTitle());
        render();
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    public DJPult pult() {
        return pult;
    }

    /** Redraws every slot from the current playback state. */
    public void render() {
        PultConfig config = plugin.pultConfig();
        List<Song> songs = plugin.library().songs();
        SongPlayer player = plugin.playback().playerFor(pult);

        inventory.clear();

        int pages = Math.max(1, (int) Math.ceil(songs.size() / (double) SONGS_PER_PAGE));
        page = Math.max(0, Math.min(page, pages - 1));

        for (int slot = 0; slot < SONGS_PER_PAGE; slot++) {
            int index = page * SONGS_PER_PAGE + slot;
            if (index >= songs.size()) {
                break;
            }
            Song song = songs.get(index);
            boolean current = player.song() != null && player.song().id().equals(song.id());
            inventory.setItem(slot, songItem(song, current, player));
        }

        for (int slot = SONGS_PER_PAGE; slot < SIZE; slot++) {
            inventory.setItem(slot, filler());
        }

        inventory.setItem(SLOT_PREVIOUS, button(Material.ARROW,
                "<yellow>Vorheriger Titel", List.of("<gray>Springt zum Titel davor")));
        inventory.setItem(SLOT_PLAY_PAUSE, playPauseButton(player));
        inventory.setItem(SLOT_STOP, button(Material.RED_DYE,
                "<red>Stopp", List.of("<gray>Beendet die Wiedergabe")));
        inventory.setItem(SLOT_NEXT, button(Material.ARROW,
                "<yellow>Nächster Titel", List.of("<gray>Springt zum Titel danach")));
        inventory.setItem(SLOT_INFO, infoItem(player));
        inventory.setItem(SLOT_LOOP, toggle(Material.REPEATER, "Wiederholen", pult.loop(),
                "<gray>Spielt den Titel endlos"));
        inventory.setItem(SLOT_SHUFFLE, toggle(Material.ENDER_PEARL, "Zufall", pult.shuffle(),
                "<gray>Wählt am Ende einen zufälligen Titel"));

        inventory.setItem(SLOT_VOLUME_DOWN, button(Material.PRISMARINE_SHARD,
                "<aqua>Leiser", List.of("<gray>-" + Math.round(VOLUME_STEP * 100) + " %")));
        inventory.setItem(SLOT_VOLUME, button(Material.NOTE_BLOCK,
                "<white>Lautstärke: <yellow>" + Math.round(pult.volume() * 100) + " %",
                List.of("<gray>" + bar(pult.volume()))));
        inventory.setItem(SLOT_VOLUME_UP, button(Material.PRISMARINE_CRYSTALS,
                "<aqua>Lauter", List.of("<gray>+" + Math.round(VOLUME_STEP * 100) + " %")));

        double radius = Math.min(config.maxRadius(), pult.radius());
        inventory.setItem(SLOT_RADIUS_DOWN, button(Material.IRON_NUGGET,
                "<aqua>Kleinerer Umkreis", List.of("<gray>-" + (int) RADIUS_STEP + " Blöcke")));
        inventory.setItem(SLOT_RADIUS, button(Material.COMPASS,
                "<white>Umkreis: <yellow>" + (int) Math.round(radius) + " Blöcke",
                List.of("<gray>Weiter weg wird es leiser",
                        "<dark_gray>Maximum: " + (int) Math.round(config.maxRadius()))));
        inventory.setItem(SLOT_RADIUS_UP, button(Material.IRON_INGOT,
                "<aqua>Größerer Umkreis", List.of("<gray>+" + (int) RADIUS_STEP + " Blöcke")));

        if (pages > 1) {
            inventory.setItem(SLOT_PAGE_PREVIOUS, button(Material.SPECTRAL_ARROW,
                    "<yellow>Seite zurück", List.of()));
            inventory.setItem(SLOT_PAGE_INFO, button(Material.BOOK,
                    "<white>Seite <yellow>" + (page + 1) + "<white>/<yellow>" + pages,
                    List.of("<gray>" + songs.size() + " Titel geladen")));
            inventory.setItem(SLOT_PAGE_NEXT, button(Material.SPECTRAL_ARROW,
                    "<yellow>Seite vor", List.of()));
        } else {
            inventory.setItem(SLOT_PAGE_INFO, button(Material.BOOK,
                    "<white>" + songs.size() + " Titel", List.of("<gray>Alle passen auf eine Seite")));
        }
    }

    /** Handles a click on the panel. Returns silently for decorative slots. */
    public void handleClick(Player viewer, int slot) {
        SongPlayer player = plugin.playback().playerFor(pult);
        List<Song> songs = plugin.library().songs();

        if (slot >= 0 && slot < SONGS_PER_PAGE) {
            int index = page * SONGS_PER_PAGE + slot;
            if (index < songs.size()) {
                Song song = songs.get(index);
                player.play(song);
                pult.setSongId(song.id());
                viewer.sendMessage(plugin.pultConfig().message("now-playing", "song", song.title()));
            }
            render();
            return;
        }

        switch (slot) {
            case SLOT_PLAY_PAUSE -> {
                if (player.song() == null) {
                    selectedOrFirst(songs).ifPresent(song -> {
                        player.play(song);
                        pult.setSongId(song.id());
                    });
                } else {
                    player.togglePause();
                }
            }
            case SLOT_STOP -> player.stop();
            case SLOT_NEXT -> step(player, songs, 1);
            case SLOT_PREVIOUS -> step(player, songs, -1);
            case SLOT_LOOP -> pult.setLoop(!pult.loop());
            case SLOT_SHUFFLE -> pult.setShuffle(!pult.shuffle());
            case SLOT_VOLUME_UP -> pult.setVolume(pult.volume() + VOLUME_STEP);
            case SLOT_VOLUME_DOWN -> pult.setVolume(pult.volume() - VOLUME_STEP);
            case SLOT_RADIUS_UP -> pult.setRadius(Math.min(plugin.pultConfig().maxRadius(),
                    pult.radius() + RADIUS_STEP));
            case SLOT_RADIUS_DOWN -> pult.setRadius(Math.max(RADIUS_STEP, pult.radius() - RADIUS_STEP));
            case SLOT_PAGE_NEXT -> page++;
            case SLOT_PAGE_PREVIOUS -> page--;
            default -> {
                return;
            }
        }
        render();
    }

    private void step(SongPlayer player, List<Song> songs, int direction) {
        if (songs.isEmpty()) {
            return;
        }
        Optional<Song> target = direction > 0
                ? plugin.library().next(player.song())
                : plugin.library().previous(player.song());
        target.ifPresent(song -> {
            player.play(song);
            pult.setSongId(song.id());
        });
    }

    private Optional<Song> selectedOrFirst(List<Song> songs) {
        String selected = pult.songId();
        if (selected != null) {
            Optional<Song> stored = plugin.library().byId(selected);
            if (stored.isPresent()) {
                return stored;
            }
        }
        return songs.isEmpty() ? Optional.empty() : Optional.of(songs.get(0));
    }

    private ItemStack songItem(Song song, boolean current, SongPlayer player) {
        List<String> lore = new ArrayList<>();
        if (!song.author().isBlank()) {
            lore.add("<gray>von <white>" + song.author());
        }
        lore.add("<gray>Länge: <white>" + time(song.durationSeconds()));
        lore.add("<dark_gray>" + song.noteCount() + " Noten");
        lore.add("");
        if (current && player.isPlaying()) {
            lore.add("<green>▶ Läuft gerade");
        } else if (current && player.isPaused()) {
            lore.add("<yellow>❚❚ Pausiert");
        } else {
            lore.add("<yellow>Klicken zum Abspielen");
        }

        ItemStack item = button(current ? Material.MUSIC_DISC_PIGSTEP : Material.MUSIC_DISC_13,
                (current ? "<gold>" : "<white>") + song.title(), lore);
        if (current) {
            item.editMeta(meta -> meta.setEnchantmentGlintOverride(true));
        }
        return item;
    }

    private ItemStack playPauseButton(SongPlayer player) {
        if (player.isPlaying()) {
            return button(Material.YELLOW_DYE, "<yellow>Pause",
                    List.of("<gray>Hält die Wiedergabe an"));
        }
        return button(Material.LIME_DYE, "<green>Abspielen",
                List.of("<gray>Startet den gewählten Titel"));
    }

    private ItemStack infoItem(SongPlayer player) {
        List<String> lore = new ArrayList<>();
        Song song = player.song();
        if (song == null) {
            lore.add("<gray>Kein Titel gewählt");
        } else {
            lore.add("<white>" + song.title());
            if (!song.author().isBlank()) {
                lore.add("<gray>von <white>" + song.author());
            }
            lore.add("");
            lore.add("<gray>" + bar(player.progress()));
            lore.add("<yellow>" + time(player.elapsedSeconds()) + "<gray> / <yellow>"
                    + time(song.durationSeconds()));
            lore.add("");
            lore.add(switch (player.state()) {
                case PLAYING -> "<green>▶ Läuft";
                case PAUSED -> "<yellow>❚❚ Pausiert";
                case STOPPED -> "<red>■ Gestoppt";
            });
        }
        return button(Material.JUKEBOX, "<gold><bold>Jetzt läuft", lore);
    }

    private ItemStack toggle(Material material, String label, boolean enabled, String description) {
        ItemStack item = button(material,
                (enabled ? "<green>" : "<red>") + label + ": " + (enabled ? "an" : "aus"),
                List.of(description, enabled ? "<gray>Klicken zum Ausschalten" : "<gray>Klicken zum Einschalten"));
        if (enabled) {
            item.editMeta(meta -> meta.setEnchantmentGlintOverride(true));
        }
        return item;
    }

    private ItemStack filler() {
        return button(Material.GRAY_STAINED_GLASS_PANE, "<dark_gray>", List.of());
    }

    private static ItemStack button(Material material, String name, List<String> lore) {
        ItemStack item = new ItemStack(material);
        item.editMeta(meta -> {
            meta.displayName(PultConfig.mini(name).decoration(TextDecoration.ITALIC, false));
            if (!lore.isEmpty()) {
                List<Component> lines = new ArrayList<>();
                for (String line : lore) {
                    lines.add(PultConfig.mini(line).decoration(TextDecoration.ITALIC, false));
                }
                meta.lore(lines);
            }
        });
        return item;
    }

    private static String bar(double progress) {
        int filled = (int) Math.round(Math.max(0, Math.min(1, progress)) * BAR_LENGTH);
        return "<green>" + "█".repeat(filled) + "<dark_gray>" + "█".repeat(BAR_LENGTH - filled);
    }

    private static String time(double seconds) {
        int total = (int) Math.max(0, Math.round(seconds));
        return String.format("%d:%02d", total / 60, total % 60);
    }
}
