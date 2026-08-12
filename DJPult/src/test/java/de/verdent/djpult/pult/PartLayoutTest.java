package de.verdent.djpult.pult;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PartLayoutTest {

    @Test
    void roundsYawToQuarterTurns() {
        assertEquals(0f, PartLayout.snapYaw(37f));
        assertEquals(90f, PartLayout.snapYaw(65f));
        assertEquals(180f, PartLayout.snapYaw(200f));
        assertEquals(270f, PartLayout.snapYaw(260f));
    }

    @Test
    void normalisesYawIntoASingleTurn() {
        assertEquals(0f, PartLayout.snapYaw(350f));
        assertEquals(0f, PartLayout.snapYaw(-10f));
        assertEquals(270f, PartLayout.snapYaw(-100f));
        assertEquals(90f, PartLayout.snapYaw(450f));
        for (float yaw = -720f; yaw <= 720f; yaw += 7f) {
            float snapped = PartLayout.snapYaw(yaw);
            assertTrue(snapped >= 0f && snapped < 360f, "yaw " + yaw + " snapped to " + snapped);
        }
    }

    @Test
    void putsTheRightHandSideWhereTheDeckIsFacing() {
        // Facing south (yaw 0) the deck's right is west, and so on around the compass.
        assertEquals(-1.0, PartLayout.offsetX(0, 1, 0));
        assertEquals(0.0, PartLayout.offsetZ(0, 1, 0));

        assertEquals(0.0, PartLayout.offsetX(1, 1, 0));
        assertEquals(-1.0, PartLayout.offsetZ(1, 1, 0));

        assertEquals(1.0, PartLayout.offsetX(2, 1, 0));
        assertEquals(0.0, PartLayout.offsetZ(2, 1, 0));

        assertEquals(0.0, PartLayout.offsetX(3, 1, 0));
        assertEquals(1.0, PartLayout.offsetZ(3, 1, 0));
    }

    @Test
    void pointsForwardAlongTheFacingDirection() {
        assertEquals(0.0, PartLayout.offsetX(0, 0, 1));
        assertEquals(1.0, PartLayout.offsetZ(0, 0, 1));

        assertEquals(-1.0, PartLayout.offsetX(1, 0, 1));
        assertEquals(0.0, PartLayout.offsetZ(1, 0, 1));
    }

    @Test
    void keepsRightPerpendicularToForward() {
        for (int quarter = 0; quarter < 4; quarter++) {
            double rightX = PartLayout.offsetX(quarter, 1, 0);
            double rightZ = PartLayout.offsetZ(quarter, 1, 0);
            double forwardX = PartLayout.offsetX(quarter, 0, 1);
            double forwardZ = PartLayout.offsetZ(quarter, 0, 1);
            // Delta of zero, because the dot product can come out as negative zero.
            assertEquals(0.0, rightX * forwardX + rightZ * forwardZ, 0.0, "quarter " + quarter);
        }
    }

    @Test
    void laysAThreePartDeckOutAsAStraightRowOnTheBlockGrid() {
        for (int quarter = 0; quarter < 4; quarter++) {
            double[] xs = new double[3];
            double[] zs = new double[3];
            for (int i = 0; i < 3; i++) {
                double right = i - 1;
                xs[i] = PartLayout.offsetX(quarter, right, 0);
                zs[i] = PartLayout.offsetZ(quarter, right, 0);
                // Exact integers, otherwise the parts would sit a hair off the block edge.
                assertEquals(Math.rint(xs[i]), xs[i], "quarter " + quarter);
                assertEquals(Math.rint(zs[i]), zs[i], "quarter " + quarter);
            }
            assertEquals(0.0, xs[1]);
            assertEquals(0.0, zs[1]);
            // Three blocks wide along exactly one axis, with the middle in between.
            double spanX = Math.abs(xs[2] - xs[0]);
            double spanZ = Math.abs(zs[2] - zs[0]);
            assertEquals(2.0, spanX + spanZ, "quarter " + quarter);
            assertEquals(0.0, Math.min(spanX, spanZ), "quarter " + quarter);
            assertNotEquals(xs[0] + "/" + zs[0], xs[2] + "/" + zs[2]);
        }
    }

    @Test
    void acceptsQuartersOutsideZeroToThree() {
        assertEquals(PartLayout.offsetX(0, 1, 0), PartLayout.offsetX(4, 1, 0));
        assertEquals(PartLayout.offsetZ(3, 1, 0), PartLayout.offsetZ(-1, 1, 0));
    }
}
