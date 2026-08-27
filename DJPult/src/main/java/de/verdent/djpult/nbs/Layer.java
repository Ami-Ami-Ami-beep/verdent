package de.verdent.djpult.nbs;

/**
 * A layer of a song. Layer volume and stereo apply on top of the values of every note on it.
 *
 * @param name   display name, may be empty
 * @param volume layer volume 0-100
 * @param stereo stereo position -100 (left) to 100 (right), 0 is centered
 * @param locked whether the layer was locked in the editor; has no effect on playback
 */
public record Layer(String name, int volume, int stereo, boolean locked) {

    public static final Layer DEFAULT = new Layer("", 100, 0, false);
}
