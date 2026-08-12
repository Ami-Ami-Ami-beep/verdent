package de.verdent.djpult.nbs;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * A parsed Note Block Studio song, ready for playback.
 *
 * <p>Notes are grouped by tick so the playback loop only needs a single map lookup per tick
 * instead of scanning the whole note list.</p>
 */
public final class Song {

    private final String id;
    private final String title;
    private final String author;
    private final String originalAuthor;
    private final String description;
    /** Song speed in ticks per second, multiplied by 100 (1000 means 10 ticks per second). */
    private final int tempo;
    private final int length;
    private final List<Layer> layers;
    private final List<CustomInstrument> customInstruments;
    private final Map<Integer, List<Note>> notesByTick;
    private final int noteCount;

    public Song(String id,
                String title,
                String author,
                String originalAuthor,
                String description,
                int tempo,
                int length,
                List<Layer> layers,
                List<CustomInstrument> customInstruments,
                Map<Integer, List<Note>> notesByTick) {
        this.id = id;
        this.title = title;
        this.author = author;
        this.originalAuthor = originalAuthor;
        this.description = description;
        this.tempo = Math.max(1, tempo);
        this.length = Math.max(0, length);
        this.layers = List.copyOf(layers);
        this.customInstruments = List.copyOf(customInstruments);
        this.notesByTick = Collections.unmodifiableMap(notesByTick);
        this.noteCount = notesByTick.values().stream().mapToInt(List::size).sum();
    }

    public String id() {
        return id;
    }

    /** The song's own title, falling back to the id when the file carries no name. */
    public String title() {
        return title == null || title.isBlank() ? id : title;
    }

    public String author() {
        return author == null ? "" : author;
    }

    public String originalAuthor() {
        return originalAuthor == null ? "" : originalAuthor;
    }

    public String description() {
        return description == null ? "" : description;
    }

    public int tempo() {
        return tempo;
    }

    /** Song ticks per second. */
    public double ticksPerSecond() {
        return tempo / 100.0;
    }

    /** Total length in song ticks. */
    public int length() {
        return length;
    }

    public double durationSeconds() {
        return length / ticksPerSecond();
    }

    public int noteCount() {
        return noteCount;
    }

    public List<Layer> layers() {
        return layers;
    }

    public List<CustomInstrument> customInstruments() {
        return customInstruments;
    }

    /** The layer with the given index, or a neutral default when the file did not describe it. */
    public Layer layer(int index) {
        return index >= 0 && index < layers.size() ? layers.get(index) : Layer.DEFAULT;
    }

    /** The notes on the given tick; never {@code null}. */
    public List<Note> notesAt(int tick) {
        return notesByTick.getOrDefault(tick, List.of());
    }

    /**
     * Resolves the sound event for a note's instrument id.
     *
     * @param instrumentId the id stored in the note
     * @param customFallback sound key used when a custom instrument cannot be resolved
     */
    public String soundKeyFor(int instrumentId, String customFallback) {
        Instrument vanilla = Instrument.byId(instrumentId);
        if (vanilla != null) {
            return vanilla.soundKey();
        }
        int customIndex = instrumentId - Instrument.count();
        if (customIndex >= 0 && customIndex < customInstruments.size()) {
            String key = customInstruments.get(customIndex).soundKey();
            if (!key.isEmpty()) {
                return key;
            }
        }
        return customFallback;
    }

    /**
     * The tuning offset a custom instrument needs. Samples are usually tuned to key 45, in which
     * case no offset is applied.
     */
    public int tuningOffsetFor(int instrumentId) {
        int customIndex = instrumentId - Instrument.count();
        if (customIndex >= 0 && customIndex < customInstruments.size()) {
            return 45 - customInstruments.get(customIndex).pitch();
        }
        return 0;
    }
}
