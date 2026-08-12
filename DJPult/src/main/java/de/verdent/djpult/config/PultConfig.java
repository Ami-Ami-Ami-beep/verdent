package de.verdent.djpult.config;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Typed access to config.yml, including the message catalogue. Every value is read once on
 * {@link #reload()} so the hot playback loop never touches the configuration API.
 */
public final class PultConfig {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    /**
     * One model a deck is built from. A deck wider than a block needs several of these, because a
     * single Blockbench model cannot reach beyond its own block.
     *
     * @param itemModel       resource pack model, or {@code null} to show the plain material
     * @param customModelData legacy alternative to {@code itemModel}, 0 when unused
     * @param right           blocks to the right of the deck's middle
     * @param up              blocks above the deck's base
     * @param forward         blocks in the direction the deck faces
     * @param scale           model scale of this part
     * @param yawOffset       extra rotation of this part in degrees
     */
    public record Part(NamespacedKey itemModel, int customModelData,
                       double right, double up, double forward,
                       float scale, float yawOffset) {
    }

    private final JavaPlugin plugin;
    private final Map<String, String> messages = new HashMap<>();

    private Material material = Material.JUKEBOX;
    private NamespacedKey itemModel;
    private int customModelData;
    private float scale = 1.0f;
    private double yOffset;
    private ItemDisplay.ItemDisplayTransform displayTransform = ItemDisplay.ItemDisplayTransform.NONE;
    private List<Part> parts = List.of();
    private String itemName = "<gold><bold>DJ-Pult</bold></gold>";
    private List<String> itemLore = List.of();

    private float hitboxWidth = 1.0f;
    private float hitboxHeight = 1.0f;

    private double defaultRadius = 32.0;
    private double maxRadius = 64.0;
    private float defaultVolume = 1.0f;
    private boolean stereo = true;
    private boolean transposeOutOfRange = true;
    private String customInstrumentFallback = "minecraft:block.note_block.harp";
    private int maxNotesPerTick = 128;

    private boolean restrictControlsToOwner;
    private boolean giveItemBackOnBreak = true;

    private String guiTitle = "<gradient:#ff7b00:#ff2d95><bold>DJ-Pult</bold></gradient>";

    public PultConfig(JavaPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        plugin.saveDefaultConfig();
        plugin.reloadConfig();
        FileConfiguration config = plugin.getConfig();

        Material parsed = Material.matchMaterial(config.getString("model.material", "JUKEBOX"));
        if (parsed == null || !parsed.isItem()) {
            plugin.getLogger().warning("model.material is not a valid item, falling back to JUKEBOX");
            parsed = Material.JUKEBOX;
        }
        material = parsed;

        String modelKey = config.getString("model.item-model", "");
        itemModel = modelKey == null || modelKey.isBlank() ? null : NamespacedKey.fromString(modelKey);
        if (modelKey != null && !modelKey.isBlank() && itemModel == null) {
            plugin.getLogger().warning("model.item-model '" + modelKey + "' is not a valid namespaced key");
        }
        customModelData = Math.max(0, config.getInt("model.custom-model-data", 0));
        scale = (float) Math.max(0.05, config.getDouble("model.scale", 1.0));
        yOffset = config.getDouble("model.y-offset", 0.5);

        String transform = config.getString("model.display-transform", "NONE");
        try {
            displayTransform = ItemDisplay.ItemDisplayTransform
                    .valueOf(transform.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            plugin.getLogger().warning("model.display-transform '" + transform + "' is unknown, using NONE");
            displayTransform = ItemDisplay.ItemDisplayTransform.NONE;
        }

        parts = readParts(config);

        itemName = config.getString("item.name", itemName);
        itemLore = List.copyOf(config.getStringList("item.lore"));

        hitboxWidth = (float) Math.max(0.1, config.getDouble("hitbox.width", 1.0));
        hitboxHeight = (float) Math.max(0.1, config.getDouble("hitbox.height", 0.35));

        maxRadius = Math.max(1.0, config.getDouble("audio.max-radius", 64.0));
        defaultRadius = Math.min(maxRadius, Math.max(1.0, config.getDouble("audio.default-radius", 32.0)));
        defaultVolume = (float) Math.min(1.0, Math.max(0.05, config.getDouble("audio.default-volume", 1.0)));
        stereo = config.getBoolean("audio.stereo", true);
        transposeOutOfRange = config.getBoolean("audio.transpose-out-of-range", true);
        customInstrumentFallback = config.getString("audio.custom-instrument-fallback",
                "minecraft:block.note_block.harp");
        maxNotesPerTick = Math.max(1, config.getInt("audio.max-notes-per-tick", 128));

        restrictControlsToOwner = config.getBoolean("behaviour.restrict-controls-to-owner", false);
        giveItemBackOnBreak = config.getBoolean("behaviour.give-item-back-on-break", true);

        guiTitle = config.getString("gui.title", guiTitle);

        messages.clear();
        ConfigurationSection section = config.getConfigurationSection("messages");
        if (section != null) {
            for (String key : section.getKeys(false)) {
                messages.put(key, section.getString(key, ""));
            }
        }
    }

    /**
     * Reads {@code model.parts}. Parts without a model are skipped, so the side pieces can stay
     * empty until their Blockbench models exist. If that leaves nothing, a single part is built
     * from the plain {@code model.item-model}.
     */
    private List<Part> readParts(FileConfiguration config) {
        List<Part> found = new ArrayList<>();
        for (Map<?, ?> entry : config.getMapList("model.parts")) {
            String rawKey = string(entry, "item-model");
            NamespacedKey model = rawKey.isBlank() ? null : NamespacedKey.fromString(rawKey);
            if (!rawKey.isBlank() && model == null) {
                plugin.getLogger().warning("model.parts contains the invalid item-model '" + rawKey + "'");
            }
            int partModelData = Math.max(0, (int) number(entry, "custom-model-data", 0));
            if (model == null && partModelData == 0) {
                continue;
            }
            found.add(new Part(model, partModelData,
                    number(entry, "right", 0),
                    number(entry, "up", 0),
                    number(entry, "forward", 0),
                    (float) Math.max(0.05, number(entry, "scale", scale)),
                    (float) number(entry, "yaw-offset", 0)));
        }
        if (found.isEmpty()) {
            found.add(new Part(itemModel, customModelData, 0, 0, 0, scale, 0));
        }
        return List.copyOf(found);
    }

    private static String string(Map<?, ?> entry, String key) {
        Object value = entry.get(key);
        return value == null ? "" : value.toString().trim();
    }

    private static double number(Map<?, ?> entry, String key, double fallback) {
        Object value = entry.get(key);
        return value instanceof Number number ? number.doubleValue() : fallback;
    }

    public Material material() {
        return material;
    }

    /** The models a deck is built from, never empty. */
    public List<Part> parts() {
        return parts;
    }

    /** The middle part; its model is what the deck item shows in hand and in the inventory. */
    public Part mainPart() {
        return parts.get(mainPartIndex());
    }

    public int mainPartIndex() {
        return parts.size() / 2;
    }

    public float scale() {
        return scale;
    }

    public double yOffset() {
        return yOffset;
    }

    public ItemDisplay.ItemDisplayTransform displayTransform() {
        return displayTransform;
    }

    public String itemName() {
        return itemName;
    }

    public List<String> itemLore() {
        return itemLore;
    }

    public float hitboxWidth() {
        return hitboxWidth;
    }

    public float hitboxHeight() {
        return hitboxHeight;
    }

    public double defaultRadius() {
        return defaultRadius;
    }

    public double maxRadius() {
        return maxRadius;
    }

    public float defaultVolume() {
        return defaultVolume;
    }

    public boolean stereo() {
        return stereo;
    }

    public boolean transposeOutOfRange() {
        return transposeOutOfRange;
    }

    public String customInstrumentFallback() {
        return customInstrumentFallback;
    }

    public int maxNotesPerTick() {
        return maxNotesPerTick;
    }

    public boolean restrictControlsToOwner() {
        return restrictControlsToOwner;
    }

    public boolean giveItemBackOnBreak() {
        return giveItemBackOnBreak;
    }

    public Component guiTitle() {
        return MINI.deserialize(guiTitle);
    }

    /**
     * Renders a message from the catalogue.
     *
     * @param key          message key below {@code messages:}
     * @param placeholders alternating placeholder name and value, e.g. {@code "song", "Intro"}
     */
    public Component message(String key, String... placeholders) {
        String raw = messages.getOrDefault(key, key);
        if (placeholders.length == 0) {
            return MINI.deserialize(raw);
        }
        TagResolver[] resolvers = new TagResolver[placeholders.length / 2];
        for (int i = 0; i + 1 < placeholders.length; i += 2) {
            resolvers[i / 2] = Placeholder.unparsed(placeholders[i], placeholders[i + 1]);
        }
        return MINI.deserialize(raw, resolvers);
    }

    /** Renders arbitrary MiniMessage text, used for item names built from config strings. */
    public static Component mini(String raw, String... placeholders) {
        if (placeholders.length == 0) {
            return MINI.deserialize(raw);
        }
        TagResolver[] resolvers = new TagResolver[placeholders.length / 2];
        for (int i = 0; i + 1 < placeholders.length; i += 2) {
            resolvers[i / 2] = Placeholder.unparsed(placeholders[i], placeholders[i + 1]);
        }
        return MINI.deserialize(raw, resolvers);
    }
}
