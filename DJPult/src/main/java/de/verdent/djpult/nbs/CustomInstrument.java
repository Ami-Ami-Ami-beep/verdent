package de.verdent.djpult.nbs;

import java.util.Locale;

/**
 * An instrument a song brings along itself. Custom instruments reference a sound file that only
 * exists inside a resource pack, so they can only be heard by players who have that pack loaded.
 *
 * @param name      display name from the editor
 * @param soundFile path of the sound file relative to the resource pack's sounds folder
 * @param pitch     key the sample is tuned to (45 means it needs no transposing)
 * @param pressKey  whether the piano key should be pressed in the editor; irrelevant for playback
 */
public record CustomInstrument(String name, String soundFile, int pitch, boolean pressKey) {

    /**
     * Turns the sound file path into the namespaced sound event a client would resolve it under,
     * e.g. {@code drums/kick.ogg} becomes {@code minecraft:drums.kick}. Paths that already carry a
     * namespace are kept as they are.
     */
    public String soundKey() {
        String cleaned = soundFile.trim().replace('\\', '/');
        int dot = cleaned.lastIndexOf('.');
        int slash = cleaned.lastIndexOf('/');
        if (dot > slash) {
            cleaned = cleaned.substring(0, dot);
        }
        cleaned = cleaned.replace('/', '.').toLowerCase(Locale.ROOT);
        if (cleaned.isEmpty()) {
            return "";
        }
        return cleaned.indexOf(':') >= 0 ? cleaned : "minecraft:" + cleaned;
    }
}
