package de.verdent.djpult.audio;

import de.verdent.djpult.config.PultConfig;
import de.verdent.djpult.nbs.Layer;
import de.verdent.djpult.nbs.Note;
import de.verdent.djpult.nbs.Song;
import de.verdent.djpult.pult.DJPult;
import de.verdent.djpult.song.SongLibrary;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Drives every playing deck from a single repeating task.
 *
 * <p>Sounds are not played at the deck but a short distance in front of each listener, with a
 * volume this class works out itself. Playing them at the deck would hand the falloff to the
 * client, whose audible range is fixed at 16 blocks times the volume, and the configured radius
 * would have no effect.</p>
 */
public final class PlaybackManager {

    /** How far in front of a listener the sound is placed, keeping some sense of direction. */
    private static final double BASE_DISTANCE = 0.5;
    /** Sideways offset at full panning. */
    private static final double PAN_WIDTH = 0.45;
    /** Below this volume a note would not travel far enough to be heard anyway. */
    private static final float MIN_AUDIBLE_VOLUME = 0.05f;
    /** Safety net against songs whose tempo would ask for an absurd number of ticks at once. */
    private static final int MAX_TICKS_PER_SERVER_TICK = 32;

    private final JavaPlugin plugin;
    private final PultConfig config;
    private final SongLibrary library;

    private final Map<UUID, SongPlayer> decks = new LinkedHashMap<>();
    private final Map<String, Key> soundKeys = new HashMap<>();

    private BukkitTask task;

    public PlaybackManager(JavaPlugin plugin, PultConfig config, SongLibrary library) {
        this.plugin = plugin;
        this.config = config;
        this.library = library;
    }

    public void start() {
        if (task == null) {
            task = Bukkit.getScheduler().runTaskTimer(plugin, this::tickAll, 1L, 1L);
        }
    }

    public void shutdown() {
        if (task != null) {
            task.cancel();
            task = null;
        }
        decks.clear();
    }

    /** The playback state of a deck, created on first use. */
    public SongPlayer playerFor(DJPult pult) {
        SongPlayer existing = decks.get(pult.id());
        if (existing != null && existing.pult().isValid()) {
            return existing;
        }
        SongPlayer created = new SongPlayer(pult);
        decks.put(pult.id(), created);
        return created;
    }

    public Optional<SongPlayer> existing(DJPult pult) {
        SongPlayer player = decks.get(pult.id());
        return player != null && player.pult().isValid() ? Optional.of(player) : Optional.empty();
    }

    public void forget(DJPult pult) {
        decks.remove(pult.id());
    }

    public int playingCount() {
        return (int) decks.values().stream().filter(SongPlayer::isPlaying).count();
    }

    public void stopAll() {
        decks.values().forEach(SongPlayer::stop);
    }

    /** Clears cached sound keys after a config reload. */
    public void clearCaches() {
        soundKeys.clear();
    }

    private void tickAll() {
        Iterator<Map.Entry<UUID, SongPlayer>> iterator = decks.entrySet().iterator();
        while (iterator.hasNext()) {
            SongPlayer player = iterator.next().getValue();
            if (!player.pult().isValid()) {
                // The deck was removed or its chunk unloaded.
                iterator.remove();
                continue;
            }
            if (player.isPlaying()) {
                advance(player);
            }
        }
    }

    private void advance(SongPlayer player) {
        Song song = player.song();
        double cursor = player.cursor() + song.ticksPerSecond() / 20.0;

        int steps = 0;
        while (cursor >= 1.0 && steps++ < MAX_TICKS_PER_SERVER_TICK) {
            cursor -= 1.0;
            int tick = player.rawTick() + 1;
            player.setTick(tick);
            if (tick >= song.length()) {
                player.setCursor(0);
                onSongEnd(player);
                return;
            }
            playTick(player, tick);
        }
        player.setCursor(cursor);
    }

    private void onSongEnd(SongPlayer player) {
        DJPult pult = player.pult();
        if (pult.loop()) {
            player.restart();
            return;
        }
        if (pult.shuffle()) {
            Optional<Song> next = library.random(player.song());
            if (next.isPresent()) {
                player.play(next.get());
                pult.setSongId(next.get().id());
                return;
            }
        }
        player.stop();
    }

    private void playTick(SongPlayer player, int tick) {
        Song song = player.song();
        List<Note> notes = song.notesAt(tick);
        if (notes.isEmpty()) {
            return;
        }

        DJPult pult = player.pult();
        double radius = Math.min(config.maxRadius(), pult.radius());
        List<Ear> ears = listeners(pult.soundLocation(), radius);
        if (ears.isEmpty()) {
            return;
        }

        float deckVolume = pult.volume();
        boolean stereo = config.stereo();
        int emitted = 0;

        for (Note note : notes) {
            if (emitted >= config.maxNotesPerTick()) {
                break;
            }
            Layer layer = song.layer(note.layer());
            if (layer.volume() <= 0 || note.velocity() <= 0) {
                continue;
            }

            int key = note.key() + song.tuningOffsetFor(note.instrument());
            if (!SoundMath.inRange(key)) {
                if (!config.transposeOutOfRange()) {
                    continue;
                }
                key = SoundMath.transposeIntoRange(key);
            }

            Key sound = soundKey(song.soundKeyFor(note.instrument(), config.customInstrumentFallback()));
            if (sound == null) {
                continue;
            }
            float pitch = SoundMath.pitch(key, note.pitchCents());
            double pan = stereo
                    ? Math.max(-1.0, Math.min(1.0, (layer.stereo() + note.panning()) / 100.0))
                    : 0.0;
            emitted++;

            for (Ear ear : ears) {
                float volume = SoundMath.noteVolume(deckVolume, layer.volume(), note.velocity(), ear.falloff);
                if (volume < MIN_AUDIBLE_VOLUME) {
                    continue;
                }
                double x = ear.x + ear.rightX * pan * PAN_WIDTH;
                double z = ear.z + ear.rightZ * pan * PAN_WIDTH;
                ear.player.playSound(Sound.sound(sound, Sound.Source.RECORD, volume, pitch), x, ear.y, z);
            }
        }
    }

    /** Everyone close enough to hear the deck, together with their personal sound origin. */
    private List<Ear> listeners(Location deck, double radius) {
        List<Ear> ears = new ArrayList<>();
        for (Player player : deck.getWorld().getPlayers()) {
            Location eye = player.getEyeLocation();
            float falloff = SoundMath.falloff(eye.distance(deck), radius);
            if (falloff <= 0f) {
                continue;
            }

            double dx = deck.getX() - eye.getX();
            double dy = deck.getY() - eye.getY();
            double dz = deck.getZ() - eye.getZ();
            double length = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (length > 1.0e-4) {
                dx = dx / length * BASE_DISTANCE;
                dy = dy / length * BASE_DISTANCE;
                dz = dz / length * BASE_DISTANCE;
            } else {
                dx = 0;
                dy = 0;
                dz = 0;
            }

            // Unit vector pointing to the player's right, used to place panned notes.
            double yaw = Math.toRadians(eye.getYaw());
            ears.add(new Ear(player, falloff,
                    eye.getX() + dx, eye.getY() + dy, eye.getZ() + dz,
                    -Math.cos(yaw), -Math.sin(yaw)));
        }
        return ears;
    }

    private Key soundKey(String raw) {
        Key cached = soundKeys.get(raw);
        if (cached != null) {
            return cached;
        }
        Key key;
        try {
            key = Key.key(raw);
        } catch (RuntimeException invalid) {
            plugin.getLogger().warning("Ignoring invalid sound key '" + raw + "': " + invalid.getMessage());
            key = null;
        }
        if (key == null) {
            try {
                key = Key.key(config.customInstrumentFallback());
            } catch (RuntimeException stillInvalid) {
                key = Key.key("minecraft:block.note_block.harp");
            }
        }
        soundKeys.put(raw, key);
        return key;
    }

    /** A listener's precomputed sound origin for the current song tick. */
    private static final class Ear {

        private final Player player;
        private final float falloff;
        private final double x;
        private final double y;
        private final double z;
        private final double rightX;
        private final double rightZ;

        private Ear(Player player, float falloff, double x, double y, double z,
                    double rightX, double rightZ) {
            this.player = player;
            this.falloff = falloff;
            this.x = x;
            this.y = y;
            this.z = z;
            this.rightX = rightX;
            this.rightZ = rightZ;
        }
    }
}
