package de.verdent.djpult.nbs;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Builds synthetic .nbs byte streams so the reader can be tested without sample files. */
final class NbsWriter {

    private final ByteArrayOutputStream out = new ByteArrayOutputStream();

    NbsWriter u8(int value) {
        out.write(value & 0xFF);
        return this;
    }

    NbsWriter s16(int value) {
        out.write(value & 0xFF);
        out.write((value >> 8) & 0xFF);
        return this;
    }

    NbsWriter s32(int value) {
        out.write(value & 0xFF);
        out.write((value >> 8) & 0xFF);
        out.write((value >> 16) & 0xFF);
        out.write((value >> 24) & 0xFF);
        return this;
    }

    NbsWriter str(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        s32(bytes.length);
        out.writeBytes(bytes);
        return this;
    }

    byte[] bytes() {
        return out.toByteArray();
    }
}
