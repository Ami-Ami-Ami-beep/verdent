package de.verdent.djpult.nbs;

/**
 * The vanilla note block instruments, in the order Note Block Studio stores them.
 * The index in this enum is the instrument id written into a .nbs file.
 */
public enum Instrument {

    PIANO("minecraft:block.note_block.harp"),
    DOUBLE_BASS("minecraft:block.note_block.bass"),
    BASS_DRUM("minecraft:block.note_block.basedrum"),
    SNARE_DRUM("minecraft:block.note_block.snare"),
    CLICK("minecraft:block.note_block.hat"),
    GUITAR("minecraft:block.note_block.guitar"),
    FLUTE("minecraft:block.note_block.flute"),
    BELL("minecraft:block.note_block.bell"),
    CHIME("minecraft:block.note_block.chime"),
    XYLOPHONE("minecraft:block.note_block.xylophone"),
    IRON_XYLOPHONE("minecraft:block.note_block.iron_xylophone"),
    COW_BELL("minecraft:block.note_block.cow_bell"),
    DIDGERIDOO("minecraft:block.note_block.didgeridoo"),
    BIT("minecraft:block.note_block.bit"),
    BANJO("minecraft:block.note_block.banjo"),
    PLING("minecraft:block.note_block.pling");

    private static final Instrument[] VALUES = values();

    private final String soundKey;

    Instrument(String soundKey) {
        this.soundKey = soundKey;
    }

    /** The namespaced sound event this instrument is played with. */
    public String soundKey() {
        return soundKey;
    }

    public static int count() {
        return VALUES.length;
    }

    /** Returns the instrument for the given id, or {@code null} if the id is not a vanilla one. */
    public static Instrument byId(int id) {
        return id >= 0 && id < VALUES.length ? VALUES[id] : null;
    }
}
