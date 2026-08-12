package de.verdent.djpult.audio;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SoundMathTest {

    private static final float EPSILON = 1.0e-5f;

    @Test
    void mapsTheNoteBlockKeyRangeOntoTheClientsPitchRange() {
        assertEquals(1.0f, SoundMath.pitch(SoundMath.CENTER_KEY, 0), EPSILON);
        assertEquals(0.5f, SoundMath.pitch(SoundMath.MIN_KEY, 0), EPSILON);
        assertEquals(2.0f, SoundMath.pitch(SoundMath.MAX_KEY, 0), EPSILON);
    }

    @Test
    void treatsHundredCentsAsOneSemitone() {
        assertEquals(SoundMath.pitch(46, 0), SoundMath.pitch(45, 100), EPSILON);
        assertEquals(SoundMath.pitch(44, 0), SoundMath.pitch(45, -100), EPSILON);
    }

    @Test
    void transposesOutOfRangeKeysByWholeOctaves() {
        assertEquals(33, SoundMath.transposeIntoRange(21));
        assertEquals(46, SoundMath.transposeIntoRange(70));
        assertEquals(45, SoundMath.transposeIntoRange(45));
        // Whatever key goes in, the result must be playable.
        for (int key = 0; key <= 87; key++) {
            assertTrue(SoundMath.inRange(SoundMath.transposeIntoRange(key)), "key " + key);
        }
    }

    @Test
    void knowsWhichKeysTheClientCanPlay() {
        assertTrue(SoundMath.inRange(33));
        assertTrue(SoundMath.inRange(57));
        assertFalse(SoundMath.inRange(32));
        assertFalse(SoundMath.inRange(58));
    }

    @Test
    void fadesOutLinearlyTowardsTheEdgeOfTheRadius() {
        assertEquals(1.0f, SoundMath.falloff(0, 32), EPSILON);
        assertEquals(0.5f, SoundMath.falloff(16, 32), EPSILON);
        assertEquals(0.0f, SoundMath.falloff(32, 32), EPSILON);
        assertEquals(0.0f, SoundMath.falloff(40, 32), EPSILON);
        assertEquals(0.0f, SoundMath.falloff(1, 0), EPSILON);
    }

    @Test
    void combinesDeckVolumeLayerVolumeAndVelocity() {
        assertEquals(1.0f, SoundMath.noteVolume(1.0f, 100, 100, 1.0f), EPSILON);
        assertEquals(0.5f, SoundMath.noteVolume(1.0f, 50, 100, 1.0f), EPSILON);
        assertEquals(0.25f, SoundMath.noteVolume(1.0f, 50, 50, 1.0f), EPSILON);
        assertEquals(0.125f, SoundMath.noteVolume(0.5f, 50, 50, 1.0f), EPSILON);
        assertEquals(0.0f, SoundMath.noteVolume(1.0f, 100, 100, 0.0f), EPSILON);
    }

    @Test
    void neverLetsVolumeLeaveTheAllowedRange() {
        assertEquals(1.0f, SoundMath.noteVolume(2.0f, 100, 100, 1.0f), EPSILON);
        assertEquals(0.0f, SoundMath.noteVolume(1.0f, 0, 100, 1.0f), EPSILON);
    }
}
