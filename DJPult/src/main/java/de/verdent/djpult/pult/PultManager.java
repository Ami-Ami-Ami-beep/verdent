package de.verdent.djpult.pult;

import de.verdent.djpult.config.PultConfig;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.block.Block;
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

/**
 * Places, finds and removes DJ decks.
 *
 * <p>A deck is built from several models side by side, because one Blockbench model cannot reach
 * beyond its own block. Each part gets an {@link ItemDisplay} for the model and an
 * {@link Interaction} for the click box, so every part opens the panel. The middle part's
 * interaction is the deck: it holds all settings and the ids of the other entities.</p>
 */
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

    /** Whether every block a deck would occupy is free. */
    public boolean canPlace(Location base, float yaw) {
        int quarter = PartLayout.quarter(yaw);
        for (PultConfig.Part part : config.parts()) {
            Block block = partLocation(base, quarter, part, 0f).getBlock();
            if (!block.isEmpty() && !block.isPassable()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Spawns a deck.
     *
     * @param owner the player the deck is credited to
     * @param base  the block the middle part stands on, already centred horizontally
     * @param yaw   rotation in degrees; rounded to a quarter turn so the parts land on block edges
     */
    public DJPult place(Player owner, Location base, float yaw) {
        World world = base.getWorld();
        List<PultConfig.Part> parts = config.parts();
        int mainIndex = config.mainPartIndex();
        int quarter = PartLayout.quarter(yaw);
        float snapped = PartLayout.snapYaw(yaw);

        // The middle interaction has to exist first: every other entity points back at it.
        Interaction main = spawnInteraction(world, partLocation(base, quarter, parts.get(mainIndex), snapped));
        PersistentDataContainer data = main.getPersistentDataContainer();
        data.set(keys.owner, PersistentDataType.STRING, owner.getUniqueId().toString());
        data.set(keys.volume, PersistentDataType.FLOAT, config.defaultVolume());
        data.set(keys.radius, PersistentDataType.DOUBLE, config.defaultRadius());

        List<Entity> satellites = new ArrayList<>();
        for (int index = 0; index < parts.size(); index++) {
            PultConfig.Part part = parts.get(index);
            Location partBase = partLocation(base, quarter, part, snapped);

            ItemDisplay display = spawnDisplay(world, partBase, part);
            linkTo(display, main);
            satellites.add(display);

            if (index != mainIndex) {
                Interaction extra = spawnInteraction(world, partBase);
                linkTo(extra, main);
                satellites.add(extra);
            }
        }

        DJPult pult = new DJPult(keys, main);
        pult.setParts(satellites);
        return pult;
    }

    /** Resolves a deck from any of its entities. */
    public Optional<DJPult> fromEntity(Entity entity) {
        if (!isMarked(entity)) {
            return Optional.empty();
        }
        String raw = entity.getPersistentDataContainer().get(keys.interactionId, PersistentDataType.STRING);
        if (raw != null) {
            try {
                Entity linked = plugin.getServer().getEntity(UUID.fromString(raw));
                if (linked instanceof Interaction main && isMarked(main)) {
                    return Optional.of(new DJPult(keys, main));
                }
            } catch (IllegalArgumentException malformed) {
                return Optional.empty();
            }
            return Optional.empty();
        }
        // No back reference: this is the middle interaction, which is the deck itself.
        return entity instanceof Interaction main ? Optional.of(new DJPult(keys, main)) : Optional.empty();
    }

    public boolean isDeckEntity(Entity entity) {
        return (entity instanceof Interaction || entity instanceof ItemDisplay) && isMarked(entity);
    }

    /** Removes every entity the deck consists of. */
    public void remove(DJPult pult) {
        for (Entity part : pult.parts()) {
            part.remove();
        }
        pult.interaction().remove();
    }

    /** Every deck within {@code range} blocks of a location, nearest first. */
    public List<DJPult> near(Location location, double range) {
        List<DJPult> found = new ArrayList<>();
        for (Entity entity : location.getWorld().getNearbyEntities(location, range, range, range)) {
            if (!(entity instanceof Interaction interaction) || !isMarked(interaction)) {
                continue;
            }
            // Only the middle interaction counts, otherwise one deck would show up several times.
            if (interaction.getPersistentDataContainer().has(keys.interactionId, PersistentDataType.STRING)) {
                continue;
            }
            found.add(new DJPult(keys, interaction));
        }
        found.sort(Comparator.comparingDouble(pult -> pult.location().distanceSquared(location)));
        return found;
    }

    public Optional<DJPult> nearest(Location location, double range) {
        List<DJPult> found = near(location, range);
        return found.isEmpty() ? Optional.empty() : Optional.of(found.get(0));
    }

    private Location partLocation(Location base, int quarter, PultConfig.Part part, float yaw) {
        Location location = base.clone().add(
                PartLayout.offsetX(quarter, part.right(), part.forward()),
                part.up(),
                PartLayout.offsetZ(quarter, part.right(), part.forward()));
        location.setYaw(yaw + part.yawOffset());
        location.setPitch(0);
        return location;
    }

    private ItemDisplay spawnDisplay(World world, Location partBase, PultConfig.Part part) {
        Location location = partBase.clone().add(0, config.yOffset(), 0);
        ItemDisplay display = world.spawn(location, ItemDisplay.class);
        display.setItemStack(PultItem.model(config, part));
        display.setItemDisplayTransform(config.displayTransform());
        display.setBillboard(Display.Billboard.FIXED);
        display.setTransformation(new Transformation(
                new Vector3f(),
                new AxisAngle4f(),
                new Vector3f(part.scale(), part.scale(), part.scale()),
                new AxisAngle4f()));
        display.setPersistent(true);
        mark(display);
        return display;
    }

    private Interaction spawnInteraction(World world, Location location) {
        Interaction interaction = world.spawn(location, Interaction.class);
        interaction.setInteractionWidth(config.hitboxWidth());
        interaction.setInteractionHeight(config.hitboxHeight());
        interaction.setResponsive(true);
        interaction.setPersistent(true);
        mark(interaction);
        return interaction;
    }

    private void mark(Entity entity) {
        entity.getPersistentDataContainer().set(keys.marker, PersistentDataType.BYTE, (byte) 1);
    }

    private void linkTo(Entity satellite, Interaction main) {
        satellite.getPersistentDataContainer()
                .set(keys.interactionId, PersistentDataType.STRING, main.getUniqueId().toString());
    }

    private boolean isMarked(Entity entity) {
        return entity.getPersistentDataContainer().has(keys.marker, PersistentDataType.BYTE);
    }
}
