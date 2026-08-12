package de.verdent.djpult.nbs;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Reads .nbs files written by (Open) Note Block Studio.
 *
 * <p>All values are little endian and signed, strings are a 32 bit length followed by that many
 * bytes. Format versions 0 through 5 are supported: version 0 is the original layout, from
 * version 1 on the file starts with a zero short followed by the version byte.</p>
 *
 * <p>Instrument ids are normalised while reading: older files knew fewer vanilla instruments, so
 * their custom instrument ids are shifted up to always start right after {@link Instrument}.</p>
 */
public final class NbsReader {

    /** Files larger than this are rejected outright rather than parsed into memory. */
    private static final long MAX_FILE_SIZE = 32L * 1024 * 1024;

    private final ByteBuffer buf;
    private int version;
    private int vanillaInstrumentCount = Instrument.count();

    private NbsReader(byte[] data) {
        this.buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
    }

    /** Reads a song from disk, deriving its id from the file name. */
    public static Song read(Path path) throws IOException {
        long size = Files.size(path);
        if (size > MAX_FILE_SIZE) {
            throw new NbsFormatException("File is too large to be a song: " + size + " bytes");
        }
        return read(Files.readAllBytes(path), idFromFileName(path));
    }

    public static Song read(byte[] data, String id) throws IOException {
        return new NbsReader(data).parse(id);
    }

    /** Turns {@code My Song.nbs} into the stable id {@code my_song}. */
    public static String idFromFileName(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            name = name.substring(0, dot);
        }
        String id = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]+", "_");
        id = id.replaceAll("^_+|_+$", "");
        return id.isEmpty() ? "song" : id;
    }

    private Song parse(String id) throws IOException {
        int length = readHeaderStart();

        int layerCount = u16();
        String title = str();
        String author = str();
        String originalAuthor = str();
        String description = str();
        int tempo = u16();
        u8();                       // auto saving on/off
        u8();                       // auto saving interval
        u8();                       // time signature
        s32();                      // minutes spent
        s32();                      // left clicks
        s32();                      // right clicks
        s32();                      // note blocks added
        s32();                      // note blocks removed
        str();                      // imported midi/schematic file name
        if (version >= 4) {
            u8();                   // loop on/off
            u8();                   // max loop count
            u16();                  // loop start tick
        }

        Map<Integer, List<Note>> notesByTick = new HashMap<>();
        int highestTick = readNotes(notesByTick);
        // Versions 1 and 2 carry no length at all, and a wrong header length would otherwise cut
        // the song short, so the last tick holding notes always wins.
        length = Math.max(length, highestTick + 1);

        List<Layer> layers = readLayers(layerCount);
        List<CustomInstrument> customInstruments = readCustomInstruments();

        if (tempo <= 0) {
            tempo = 1000;           // 10 ticks per second, the Note Block Studio default
        }
        return new Song(id, title, author, originalAuthor, description,
                tempo, length, layers, customInstruments, notesByTick);
    }

    /**
     * Reads the version marker and returns the song length stored in the header, or 0 when the
     * format version does not carry one.
     */
    private int readHeaderStart() throws NbsFormatException {
        int first = u16();
        if (first != 0) {
            // Original format: the file starts straight with the song length.
            version = 0;
            vanillaInstrumentCount = 10;
            return first;
        }
        version = u8();
        vanillaInstrumentCount = u8();
        if (vanillaInstrumentCount <= 0 || vanillaInstrumentCount > Instrument.count()) {
            vanillaInstrumentCount = Instrument.count();
        }
        // Versions 1 and 2 dropped the length field; it came back in version 3.
        return version >= 3 ? u16() : 0;
    }

    private int readNotes(Map<Integer, List<Note>> notesByTick) throws NbsFormatException {
        int tick = -1;
        int highestTick = -1;
        while (true) {
            int tickJump = u16();
            if (tickJump == 0) {
                break;
            }
            tick += tickJump;
            highestTick = tick;

            int layer = -1;
            while (true) {
                int layerJump = u16();
                if (layerJump == 0) {
                    break;
                }
                layer += layerJump;

                int instrument = normaliseInstrument(u8());
                int key = u8();
                int velocity = 100;
                int panning = 0;
                int pitchCents = 0;
                if (version >= 4) {
                    velocity = clamp(u8(), 0, 100);
                    panning = clamp(u8(), 0, 200) - 100;
                    pitchCents = s16();
                }
                notesByTick.computeIfAbsent(tick, t -> new ArrayList<>())
                        .add(new Note(layer, instrument, key, velocity, panning, pitchCents));
            }
        }
        return highestTick;
    }

    private List<Layer> readLayers(int layerCount) {
        List<Layer> layers = new ArrayList<>();
        for (int i = 0; i < layerCount; i++) {
            try {
                String name = str();
                boolean locked = version >= 4 && u8() != 0;
                int volume = clamp(u8(), 0, 100);
                int stereo = version >= 2 ? clamp(u8(), 0, 200) - 100 : 0;
                layers.add(new Layer(name, volume, stereo, locked));
            } catch (NbsFormatException truncated) {
                // Some files stop short of describing every layer; the rest keeps its defaults.
                break;
            }
        }
        while (layers.size() < layerCount) {
            layers.add(Layer.DEFAULT);
        }
        return layers;
    }

    private List<CustomInstrument> readCustomInstruments() {
        List<CustomInstrument> instruments = new ArrayList<>();
        try {
            int count = u8();
            for (int i = 0; i < count; i++) {
                String name = str();
                String file = str();
                int pitch = u8();
                boolean pressKey = u8() != 0;
                instruments.add(new CustomInstrument(name, file, pitch, pressKey));
            }
        } catch (NbsFormatException truncated) {
            // Custom instruments are optional trailing data; whatever we got is good enough.
        }
        return instruments;
    }

    /** Shifts custom instrument ids of older files so they start after the vanilla instruments. */
    private int normaliseInstrument(int id) {
        if (id < vanillaInstrumentCount) {
            return id;
        }
        return Instrument.count() + (id - vanillaInstrumentCount);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private void require(int bytes) throws NbsFormatException {
        if (buf.remaining() < bytes) {
            throw new NbsFormatException("Unexpected end of file after " + buf.position() + " bytes");
        }
    }

    private int u8() throws NbsFormatException {
        require(1);
        return buf.get() & 0xFF;
    }

    private int u16() throws NbsFormatException {
        require(2);
        return buf.getShort() & 0xFFFF;
    }

    private int s16() throws NbsFormatException {
        require(2);
        return buf.getShort();
    }

    private int s32() throws NbsFormatException {
        require(4);
        return buf.getInt();
    }

    private String str() throws NbsFormatException {
        int length = s32();
        if (length < 0 || length > buf.remaining()) {
            throw new NbsFormatException("Malformed string of length " + length);
        }
        byte[] bytes = new byte[length];
        buf.get(bytes);
        return new String(bytes, StandardCharsets.UTF_8).trim();
    }
}
