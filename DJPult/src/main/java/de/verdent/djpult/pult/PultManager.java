package de.verdent.djpult.pult;

import de.verdent.djpult.config.PultConfig;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Interaction;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.util.Transformation;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Places, finds and removes DJ decks. */
public final class PultManager {

    private final JavaPlugin plugin;
    private final PultConfig config;
    private final PultKeys keys;

    public PultManager(JavaPlugin plugin, PultConfig config, PultKeys keys) {
        this.plugin = plugin;
        this.config = config;
        this.keys = keys;
    }

    public PultKeys keys() {
        return keys;
    }

    /**
     * Spawns a deck.
     *
     * @param owner the player the deck is credited to
     * @param base  the block corner the deck stands on, already centred horizontally
     * @param yaw   rotation in degrees
     */
    public DJPult place(Player owner, Location base, float yaw) {
        World world = base.getWorld();

        Location displayLocation = base.clone().add(0, config.yOffset(), 0);
        displayLocation.setYaw(yaw);
        displayLocation.setPitch(0);

        ItemDisplay display = world.spawn(displayLocation, ItemDisplay.class);
        display.setItemStack(PultItem.model(config));
        display.setItemDisplayTransform(config.displayTransform());
        display.setBillboard(Display.Billboard.FIXED);
        display.setTransformation(new Transformation(
                new Vector3f(),
                new AxisAngle4f(),
                new Vector3f(config.scale(), config.scale(), config.scale()),
                new AxisAngle4f()));
        display.setPersistent(true);
        display.getPersistentDataContainer().set(keys.marker, PersistentDataType.BYTE, (byte) 1);

        Location interactionLocation = base.clone();
        interactionLocation.setYaw(yaw);
        interactionLocation.setPitch(0);

        Interaction interaction = world.spawn(interactionLocation, Interaction.class);
        interaction.setInteractionWidth(config.hitboxWidth());
        interaction.setInteractionHeight(config.hitboxHeight());
        interaction.setResponsive(true);
        interaction.setPersistent(true);

        PersistentDataContainer data = interaction.getPersistentDataContainer();
        data.set(keys.marker, PersistentDataType.BYTE, (byte) 1);
        data.set(keys.displayId, PersistentDataType.STRING, display.getUniqueId().toString());
        data.set(keys.owner, PersistentDataType.STRING, owner.getUniqueId().toString());
        data.set(keys.volume, PersistentDataType.FLOAT, config.defaultVolume());
        data.set(keys.radius, PersistentDataType.DOUBLE, config.defaultRadius());

        display.getPersistentDataContainer()
                .set(keys.interactionId, PersistentDataType.STRING, interaction.getUniqueId().toString());

        return new DJPult(keys, interaction);
    }

    /** Resolves a deck from either of its two entities. */
    public Optional<DJPult> fromEntity(Entity entity) {
        if (entity instanceof Interaction interaction && isMarked(interaction)) {
            return Optional.of(new DJPult(keys, interaction));
        }
        if (entity instanceof ItemDisplay display && isMarked(display)) {
            String raw = display.getPersistentDataContainer()
                    .get(keys.interactionId, PersistentDataType.STRING);
            if (raw == null) {
                return Optional.empty();
            }
            try {
                Entity linked = plugin.getServer().getEntity(UUID.fromString(raw));
                if (linked instanceof Interaction interaction && isMarked(interaction)) {
                    return Optional.of(new DJPult(keys, interaction));
                }
            } catch (IllegalArgumentException malformed) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    public boolean isDeckEntity(Entity entity) {
        return (entity instanceof Interaction || entity instanceof ItemDisplay) && isMarked(entity);
    }

    private boolean isMarked(Entity entity) {
        return entity.getPersistentDataContainer().has(keys.marker, PersistentDataType.BYTE);
    }

    /** Removes both entities of a deck. */
    public void remove(DJPult pult) {
        ItemDisplay display = pult.display();
        if (display != null) {
            display.remove();
        }
        pult.interaction().remove();
    }

    /** Every deck within {@code range} blocks of a location, nearest first. */
    public List<DJPult> near(Location location, double range) {
        List<DJPult> found = new ArrayList<>();
        for (Entity entity : location.getWorld().getNearbyEntities(location, range, range, range)) {
            if (entity instanceof Interaction interaction && isMarked(interaction)) {
                found.add(new DJPult(keys, interaction));
            }
        }
        found.sort(Comparator.comparingDouble(pult -> pult.location().distanceSquared(location)));
        return found;
    }

    public Optional<DJPult> nearest(Location location, double range) {
        List<DJPult> found = near(location, range);
        return found.isEmpty() ? Optional.empty() : Optional.of(found.get(0));
    }
}
