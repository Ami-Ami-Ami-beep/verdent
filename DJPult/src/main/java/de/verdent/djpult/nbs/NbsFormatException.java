package de.verdent.djpult.nbs;

import java.io.IOException;

/** Thrown when a .nbs file is truncated or does not follow the Note Block Studio format. */
public class NbsFormatException extends IOException {

    public NbsFormatException(String message) {
        super(message);
    }
}
