package de.verdent.djpult.nbs;

/**
 * A single note of a song.
 *
 * @param layer      index of the layer the note sits on
 * @param instrument instrument id; ids below {@link Instrument#count()} are vanilla instruments,
 *                   higher ids refer to the song's custom instruments
 * @param key        piano key 0-87, where 45 is F#4 and plays at pitch 1.0
 * @param velocity   note volume 0-100
 * @param panning    stereo position -100 (left) to 100 (right), 0 is centered
 * @param pitchCents fine pitch offset in cents (only present from format version 4 on)
 */
public record Note(int layer, int instrument, int key, int velocity, int panning, int pitchCents) {
}
