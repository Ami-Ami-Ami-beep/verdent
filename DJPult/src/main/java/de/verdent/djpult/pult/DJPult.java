package de.verdent.djpult.pult;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Interaction;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;

import java.util.UUID;

/**
 * A placed DJ deck. The {@link Interaction} entity is the source of truth: it provides the click
 * hitbox and carries every setting in its persistent data container.
 */
public final class DJPult {

    private final PultKeys keys;
    private final Interaction interaction;

    DJPult(PultKeys keys, Interaction interaction) {
        this.keys = keys;
        this.interaction = interaction;
    }

    public UUID id() {
        return interaction.getUniqueId();
    }

    public Interaction interaction() {
        return interaction;
    }

    public boolean isValid() {
        return interaction.isValid();
    }

    public World world() {
        return interaction.getWorld();
    }

    public Location location() {
        return interaction.getLocation();
    }

    /** Where the music comes from: slightly above the base, so it lines up with the model. */
    public Location soundLocation() {
        return interaction.getLocation().add(0, interaction.getInteractionHeight() / 2.0, 0);
    }

    /** The entity rendering the model, or {@code null} when it was removed by other means. */
    public ItemDisplay display() {
        String raw = data().get(keys.displayId, PersistentDataType.STRING);
        if (raw == null) {
            return null;
        }
        try {
            Entity entity = Bukkit.getEntity(UUID.fromString(raw));
            return entity instanceof ItemDisplay itemDisplay ? itemDisplay : null;
        } catch (IllegalArgumentException malformed) {
            return null;
        }
    }

    void setDisplay(ItemDisplay display) {
        data().set(keys.displayId, PersistentDataType.STRING, display.getUniqueId().toString());
    }

    public UUID owner() {
        String raw = data().get(keys.owner, PersistentDataType.STRING);
        if (raw == null) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException malformed) {
            return null;
        }
    }

    void setOwner(UUID owner) {
        data().set(keys.owner, PersistentDataType.STRING, owner.toString());
    }

    public float volume() {
        Float stored = data().get(keys.volume, PersistentDataType.FLOAT);
        return stored == null ? 1.0f : clamp(stored, 0.05f, 1.0f);
    }

    public void setVolume(float volume) {
        data().set(keys.volume, PersistentDataType.FLOAT, clamp(volume, 0.05f, 1.0f));
    }

    public double radius() {
        Double stored = data().get(keys.radius, PersistentDataType.DOUBLE);
        return stored == null ? 32.0 : Math.max(1.0, stored);
    }

    public void setRadius(double radius) {
        data().set(keys.radius, PersistentDataType.DOUBLE, Math.max(1.0, radius));
    }

    public boolean loop() {
        return flag(keys.loop);
    }

    public void setLoop(boolean loop) {
        setFlag(keys.loop, loop);
    }

    public boolean shuffle() {
        return flag(keys.shuffle);
    }

    public void setShuffle(boolean shuffle) {
        setFlag(keys.shuffle, shuffle);
    }

    /** Id of the song last selected on this deck, or {@code null} when nothing was chosen yet. */
    public String songId() {
        return data().get(keys.song, PersistentDataType.STRING);
    }

    public void setSongId(String songId) {
        if (songId == null) {
            data().remove(keys.song);
        } else {
            data().set(keys.song, PersistentDataType.STRING, songId);
        }
    }

    private boolean flag(org.bukkit.NamespacedKey key) {
        Byte stored = data().get(key, PersistentDataType.BYTE);
        return stored != null && stored != 0;
    }

    private void setFlag(org.bukkit.NamespacedKey key, boolean value) {
        data().set(key, PersistentDataType.BYTE, (byte) (value ? 1 : 0));
    }

    private PersistentDataContainer data() {
        return interaction.getPersistentDataContainer();
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DJPult pult && pult.id().equals(id());
    }

    @Override
    public int hashCode() {
        return id().hashCode();
    }
}
