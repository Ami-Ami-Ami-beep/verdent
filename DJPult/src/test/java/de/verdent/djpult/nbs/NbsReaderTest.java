package de.verdent.djpult.nbs;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NbsReaderTest {

    @Test
    void readsModernFile() throws IOException {
        Song song = NbsReader.read(modernFile(), "test");

        assertEquals("Testsong", song.title());
        assertEquals("Autor", song.author());
        assertEquals("Original", song.originalAuthor());
        assertEquals(1000, song.tempo());
        assertEquals(10.0, song.ticksPerSecond());
        assertEquals(8, song.length());
        assertEquals(3, song.noteCount());
    }

    @Test
    void readsNotesWithJumpEncoding() throws IOException {
        Song song = NbsReader.read(modernFile(), "test");

        List<Note> firstTick = song.notesAt(0);
        assertEquals(2, firstTick.size());

        Note melody = firstTick.get(0);
        assertEquals(0, melody.layer());
        assertEquals(0, melody.instrument());
        assertEquals(45, melody.key());
        assertEquals(100, melody.velocity());
        assertEquals(0, melody.panning());

        Note custom = firstTick.get(1);
        assertEquals(1, custom.layer());
        assertEquals(16, custom.instrument());
        assertEquals(50, custom.key());
        assertEquals(80, custom.velocity());
        assertEquals(-100, custom.panning());
        assertEquals(50, custom.pitchCents());

        // The second tick jumps ahead by three, the ticks in between stay empty.
        assertTrue(song.notesAt(1).isEmpty());
        assertTrue(song.notesAt(2).isEmpty());
        assertEquals(1, song.notesAt(3).size());
    }

    @Test
    void readsLayersAndCustomInstruments() throws IOException {
        Song song = NbsReader.read(modernFile(), "test");

        assertEquals(2, song.layers().size());
        assertEquals("Melodie", song.layer(0).name());
        assertEquals(100, song.layer(0).volume());
        assertEquals(0, song.layer(0).stereo());
        assertEquals(50, song.layer(1).volume());
        assertEquals(100, song.layer(1).stereo());

        assertEquals(1, song.customInstruments().size());
        assertEquals("minecraft:drums.kick", song.customInstruments().get(0).soundKey());
        assertEquals("minecraft:block.note_block.harp",
                song.soundKeyFor(0, "minecraft:block.note_block.harp"));
        assertEquals("minecraft:drums.kick",
                song.soundKeyFor(16, "minecraft:block.note_block.harp"));
    }

    @Test
    void fallsBackForUnknownCustomInstruments() throws IOException {
        Song song = NbsReader.read(modernFile(), "test");
        assertEquals("minecraft:block.note_block.harp",
                song.soundKeyFor(99, "minecraft:block.note_block.harp"));
    }

    @Test
    void readsLegacyFileAndShiftsCustomInstrumentIds() throws IOException {
        Song song = NbsReader.read(legacyFile(), "old");

        assertEquals("Alt", song.title());
        assertEquals(4, song.length());
        assertEquals(1, song.noteCount());

        Note note = song.notesAt(0).get(0);
        // The file knew ten vanilla instruments, so its id 10 is the first custom one and has to
        // end up behind all sixteen instruments we know today.
        assertEquals(16, note.instrument());
        assertEquals(100, note.velocity());
        assertEquals("minecraft:old.sound", song.soundKeyFor(16, "minecraft:block.note_block.harp"));
    }

    @Test
    void derivesLengthWhenTheHeaderCarriesNone() throws IOException {
        // Version 2 files have no length field; it has to come from the last tick that holds notes.
        NbsWriter writer = new NbsWriter();
        writer.s16(0).u8(2).u8(10);
        header(writer, 1, "Ohne Länge", 2);
        writer.s16(6);                       // first note on tick 5
        writer.s16(1).u8(0).u8(45);
        writer.s16(0);
        writer.s16(0);
        writer.str("Layer").u8(100).u8(100);
        writer.u8(0);

        Song song = NbsReader.read(writer.bytes(), "no-length");
        assertEquals(6, song.length());
    }

    @Test
    void rejectsTruncatedFiles() {
        byte[] truncated = Arrays.copyOf(modernFile(), 24);
        assertThrows(NbsFormatException.class, () -> NbsReader.read(truncated, "broken"));
    }

    @Test
    void survivesFilesThatStopAfterTheNotes() throws IOException {
        // Layer and custom instrument data is trailing and optional; the song must still load.
        NbsWriter writer = new NbsWriter();
        writer.s16(0).u8(5).u8(16);
        writer.s16(4);
        header(writer, 2, "Abgeschnitten", 5);
        writer.s16(1);
        writer.s16(1).u8(0).u8(45).u8(100).u8(100).s16(0);
        writer.s16(0);
        writer.s16(0);

        Song song = NbsReader.read(writer.bytes(), "trailing");
        assertEquals(1, song.noteCount());
        assertEquals(2, song.layers().size());
        assertEquals(100, song.layer(1).volume());
        assertTrue(song.customInstruments().isEmpty());
    }

    @Test
    void buildsIdsFromFileNames() {
        assertEquals("my_song", NbsReader.idFromFileName(Path.of("My Song.nbs")));
        assertEquals("intro-2", NbsReader.idFromFileName(Path.of("songs", "Intro-2.NBS")));
        assertEquals("song", NbsReader.idFromFileName(Path.of("!!!.nbs")));
    }

    /** Header fields shared by every version, starting at the layer count. */
    private static void header(NbsWriter writer, int layerCount, String title, int version) {
        writer.s16(layerCount)
                .str(title)
                .str("Autor")
                .str("Original")
                .str("Beschreibung")
                .s16(1000)
                .u8(0)
                .u8(0)
                .u8(4)
                .s32(0)
                .s32(0)
                .s32(0)
                .s32(0)
                .s32(0)
                .str("");
        if (version >= 4) {
            writer.u8(0).u8(0).s16(0);
        }
    }

    private static byte[] modernFile() {
        NbsWriter writer = new NbsWriter();
        writer.s16(0).u8(5).u8(16).s16(8);
        header(writer, 2, "Testsong", 5);

        writer.s16(1);                                        // tick 0
        writer.s16(1).u8(0).u8(45).u8(100).u8(100).s16(0);    // layer 0, piano, centred
        writer.s16(1).u8(16).u8(50).u8(80).u8(0).s16(50);     // layer 1, custom, hard left
        writer.s16(0);
        writer.s16(3);                                        // tick 3
        writer.s16(1).u8(2).u8(40).u8(100).u8(100).s16(0);
        writer.s16(0);
        writer.s16(0);

        writer.str("Melodie").u8(0).u8(100).u8(100);
        writer.str("Bass").u8(0).u8(50).u8(200);

        writer.u8(1).str("Kick").str("drums/kick.ogg").u8(45).u8(0);
        return writer.bytes();
    }

    private static byte[] legacyFile() {
        NbsWriter writer = new NbsWriter();
        writer.s16(4);                                        // version 0: length comes first
        header(writer, 1, "Alt", 0);

        writer.s16(1);
        writer.s16(1).u8(10).u8(45);                          // id 10 is this file's first custom one
        writer.s16(0);
        writer.s16(0);

        writer.str("L1").u8(100);                             // no stereo before version 2

        writer.u8(1).str("Alt-Instrument").str("old/sound.ogg").u8(45).u8(0);
        return writer.bytes();
    }
}
