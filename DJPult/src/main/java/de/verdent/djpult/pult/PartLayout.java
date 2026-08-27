package de.verdent.djpult.pult;

/**
 * Where the parts of a deck sit relative to its middle.
 *
 * <p>A deck is placed in quarter turns only, so the four directions are looked up in a table
 * instead of going through sine and cosine: {@code Math.cos(Math.toRadians(90))} is 6.1e-17 rather
 * than 0, and that leftover would nudge every part a hair off the block grid.</p>
 *
 * <p>"Right" follows the same convention as the stereo panning in
 * {@code audio.PlaybackManager}: facing south (yaw 0), right points west.</p>
 *
 * <p>Free of server types on purpose, so the geometry can be unit tested.</p>
 */
public final class PartLayout {

    /** Forward direction as (x, z) per quarter turn, starting at yaw 0. */
    private static final int[][] FORWARD = {{0, 1}, {-1, 0}, {0, -1}, {1, 0}};
    /** Right-hand direction as (x, z) per quarter turn. */
    private static final int[][] RIGHT = {{-1, 0}, {0, -1}, {1, 0}, {0, 1}};

    private PartLayout() {
    }

    /** Rounds a yaw to the nearest quarter turn and normalises it to [0, 360). */
    public static float snapYaw(float yaw) {
        return quarter(yaw) * 90f;
    }

    /** Which quarter turn a yaw belongs to: 0 = south, 1 = west, 2 = north, 3 = east. */
    public static int quarter(float yaw) {
        return Math.floorMod(Math.round(yaw / 90f), 4);
    }

    /**
     * East-west offset of a part.
     *
     * @param quarter quarter turn from {@link #quarter(float)}
     * @param right   blocks to the right of the deck's middle
     * @param forward blocks in the direction the deck faces
     */
    public static double offsetX(int quarter, double right, double forward) {
        int index = Math.floorMod(quarter, 4);
        return RIGHT[index][0] * right + FORWARD[index][0] * forward;
    }

    /** North-south offset of a part; see {@link #offsetX(int, double, double)}. */
    public static double offsetZ(int quarter, double right, double forward) {
        int index = Math.floorMod(quarter, 4);
        return RIGHT[index][1] * right + FORWARD[index][1] * forward;
    }
}
