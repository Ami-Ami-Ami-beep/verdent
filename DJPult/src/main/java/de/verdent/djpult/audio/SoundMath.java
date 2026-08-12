package de.verdent.djpult.audio;

/**
 * The pitch and volume maths behind playback. Deliberately free of any server API so it can be
 * unit tested on its own.
 */
public final class SoundMath {

    /** Lowest note block key, F#3, played at pitch 0.5. */
    public static final int MIN_KEY = 33;
    /** Highest note block key, F#5, played at pitch 2.0. */
    public static final int MAX_KEY = 57;
    /** Key F#4, played at pitch 1.0. */
    public static final int CENTER_KEY = 45;

    private SoundMath() {
    }

    /**
     * The playback pitch for a key with an optional fine tuning offset.
     *
     * @param key        piano key, where {@link #CENTER_KEY} plays the sample unchanged
     * @param pitchCents fine tuning in cents, 100 cents being one semitone
     */
    public static float pitch(int key, int pitchCents) {
        double semitones = (key + pitchCents / 100.0) - CENTER_KEY;
        return (float) Math.pow(2.0, semitones / 12.0);
    }

    public static boolean inRange(int key) {
        return key >= MIN_KEY && key <= MAX_KEY;
    }

    /**
     * Moves a key into the range note blocks can actually play by shifting whole octaves. Without
     * this, bass lines and melody peaks of many songs would simply be dropped, because the client
     * clamps pitches outside 0.5 to 2.0.
     */
    public static int transposeIntoRange(int key) {
        int result = key;
        while (result < MIN_KEY) {
            result += 12;
        }
        while (result > MAX_KEY) {
            result -= 12;
        }
        return result;
    }

    /**
     * Linear volume falloff: full volume at the deck, silent at the edge of the radius.
     *
     * @return a factor between 0 and 1
     */
    public static float falloff(double distance, double radius) {
        if (radius <= 0 || distance >= radius) {
            return 0f;
        }
        if (distance <= 0) {
            return 1f;
        }
        return (float) (1.0 - distance / radius);
    }

    /**
     * Combines deck volume, layer volume and note velocity into the volume a single note is
     * played at for one listener.
     *
     * @param deckVolume   the deck's own volume, 0 to 1
     * @param layerVolume  layer volume, 0 to 100
     * @param noteVelocity note velocity, 0 to 100
     * @param falloff      distance factor from {@link #falloff(double, double)}
     */
    public static float noteVolume(float deckVolume, int layerVolume, int noteVelocity, float falloff) {
        float volume = deckVolume * falloff * (layerVolume / 100f) * (noteVelocity / 100f);
        return Math.max(0f, Math.min(1f, volume));
    }
}
