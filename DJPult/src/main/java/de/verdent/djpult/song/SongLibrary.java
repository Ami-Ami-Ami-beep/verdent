package de.verdent.djpult.song;

import de.verdent.djpult.nbs.Layer;
import de.verdent.djpult.nbs.NbsReader;
import de.verdent.djpult.nbs.Note;
import de.verdent.djpult.nbs.Song;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Holds every song the server can play. Files live in {@code plugins/DJPult/songs} and are read
 * off the main thread; the finished list is then published back on the main thread.
 */
public final class SongLibrary {

    private final JavaPlugin plugin;
    private final Path songsFolder;

    private volatile List<Song> songs = List.of();

    public SongLibrary(JavaPlugin plugin) {
        this.plugin = plugin;
        this.songsFolder = plugin.getDataFolder().toPath().resolve("songs");
    }

    public List<Song> songs() {
        return songs;
    }

    public boolean isEmpty() {
        return songs.isEmpty();
    }

    public Optional<Song> byId(String id) {
        String needle = id.toLowerCase(Locale.ROOT);
        return songs.stream().filter(song -> song.id().equals(needle)).findFirst();
    }

    /** Looks a song up by id first, then by a case insensitive title match. */
    public Optional<Song> find(String query) {
        Optional<Song> byId = byId(query);
        if (byId.isPresent()) {
            return byId;
        }
        String needle = query.toLowerCase(Locale.ROOT);
        return songs.stream()
                .filter(song -> song.title().toLowerCase(Locale.ROOT).equals(needle))
                .findFirst();
    }

    /** The song after the given one, wrapping around at the end. */
    public Optional<Song> next(Song current) {
        return neighbour(current, 1);
    }

    /** The song before the given one, wrapping around at the start. */
    public Optional<Song> previous(Song current) {
        return neighbour(current, -1);
    }

    private Optional<Song> neighbour(Song current, int step) {
        List<Song> snapshot = songs;
        if (snapshot.isEmpty()) {
            return Optional.empty();
        }
        int index = current == null ? -1 : snapshot.indexOf(current);
        if (index < 0) {
            return Optional.of(snapshot.get(step > 0 ? 0 : snapshot.size() - 1));
        }
        int next = Math.floorMod(index + step, snapshot.size());
        return Optional.of(snapshot.get(next));
    }

    public Optional<Song> random(Song exclude) {
        List<Song> snapshot = songs;
        if (snapshot.isEmpty()) {
            return Optional.empty();
        }
        if (snapshot.size() == 1) {
            return Optional.of(snapshot.get(0));
        }
        Song picked;
        do {
            picked = snapshot.get((int) (Math.random() * snapshot.size()));
        } while (picked.equals(exclude));
        return Optional.of(picked);
    }

    /**
     * Reloads the library off the main thread.
     *
     * @param whenDone run on the main thread once the new list is live; may be {@code null}
     */
    public void reloadAsync(Runnable whenDone) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            List<Song> loaded = loadFromDisk();
            Bukkit.getScheduler().runTask(plugin, () -> {
                songs = loaded;
                plugin.getLogger().info("Loaded " + loaded.size() + " song(s).");
                if (whenDone != null) {
                    whenDone.run();
                }
            });
        });
    }

    /** Blocking load, used on plugin startup where a short pause is acceptable. */
    public void reloadNow() {
        songs = loadFromDisk();
        plugin.getLogger().info("Loaded " + songs.size() + " song(s).");
    }

    private List<Song> loadFromDisk() {
        List<Song> loaded = new ArrayList<>();
        try {
            Files.createDirectories(songsFolder);
        } catch (IOException e) {
            plugin.getLogger().warning("Could not create the songs folder: " + e.getMessage());
            return List.of(DemoSong.create());
        }

        try (Stream<Path> files = Files.list(songsFolder)) {
            List<Path> candidates = files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".nbs"))
                    .sorted()
                    .toList();
            for (Path file : candidates) {
                try {
                    loaded.add(NbsReader.read(file));
                } catch (IOException | RuntimeException e) {
                    // One broken file must never stop the rest of the library from loading.
                    plugin.getLogger().warning("Skipping '" + file.getFileName() + "': " + e.getMessage());
                }
            }
        } catch (IOException e) {
            plugin.getLogger().warning("Could not read the songs folder: " + e.getMessage());
        }

        if (loaded.isEmpty()) {
            plugin.getLogger().info("No .nbs files in " + songsFolder + ", offering the built-in demo song.");
            loaded.add(DemoSong.create());
        }
        loaded.sort(Comparator.comparing(song -> song.title().toLowerCase(Locale.ROOT)));
        return List.copyOf(loaded);
    }

    /**
     * A short built-in loop so a fresh install can be tested before any song file exists.
     */
    static final class DemoSong {

        private static final int MELODY = 0;   // piano
        private static final int BASS = 1;     // double bass
        private static final int KICK = 2;     // bass drum
        private static final int HAT = 4;      // click

        private DemoSong() {
        }

        static Song create() {
            Map<Integer, List<Note>> notes = new HashMap<>();
            int[] riff = {45, 47, 49, 52, 54, 52, 49, 47};

            for (int bar = 0; bar < 4; bar++) {
                for (int step = 0; step < riff.length; step++) {
                    int tick = bar * 16 + step * 2;
                    int key = riff[step] + (bar % 2 == 0 ? 0 : 3);
                    add(notes, tick, new Note(0, MELODY, key, 100, 0, 0));
                    if (step % 2 == 0) {
                        add(notes, tick, new Note(1, BASS, key - 12, 90, 0, 0));
                    }
                    if (step % 4 == 0) {
                        add(notes, tick, new Note(2, KICK, 45, 100, 0, 0));
                    }
                    add(notes, tick + 1, new Note(2, HAT, 45, 55, 0, 0));
                }
            }

            List<Layer> layers = List.of(
                    new Layer("Melodie", 100, 0, false),
                    new Layer("Bass", 80, 0, false),
                    new Layer("Drums", 70, 0, false));

            return new Song("demo", "Demo-Loop", "DJPult", "", "Eingebauter Testsong",
                    1000, 64, layers, List.of(), notes);
        }

        private static void add(Map<Integer, List<Note>> notes, int tick, Note note) {
            notes.computeIfAbsent(tick, t -> new ArrayList<>()).add(note);
        }
    }
}
