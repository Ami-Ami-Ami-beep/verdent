package de.verdent.djpult.pult;

import de.verdent.djpult.config.PultConfig;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;

import java.util.ArrayList;
import java.util.List;

/** Builds the item players place to get a deck, and the item the display entity renders. */
public final class PultItem {

    private PultItem() {
    }

    /**
     * The item handed to players. Carries a marker so only this item places a deck, and shows the
     * middle part's model — that is the piece players recognise the deck by.
     */
    public static ItemStack create(PultConfig config, PultKeys keys) {
        ItemStack item = model(config, config.mainPart());
        item.editMeta(meta -> {
            meta.displayName(PultConfig.mini(config.itemName())
                    .decoration(TextDecoration.ITALIC, false));
            List<Component> lore = new ArrayList<>();
            for (String line : config.itemLore()) {
                lore.add(PultConfig.mini(line).decoration(TextDecoration.ITALIC, false));
            }
            if (!lore.isEmpty()) {
                meta.lore(lore);
            }
            meta.getPersistentDataContainer().set(keys.item, PersistentDataType.BYTE, (byte) 1);
        });
        return item;
    }

    /** The plain item used inside the {@code ItemDisplay} of one part; no marker or name. */
    public static ItemStack model(PultConfig config, PultConfig.Part part) {
        ItemStack item = new ItemStack(config.material());
        item.editMeta(meta -> {
            if (part.itemModel() != null) {
                meta.setItemModel(part.itemModel());
            }
            if (part.customModelData() > 0) {
                meta.setCustomModelData(part.customModelData());
            }
        });
        return item;
    }

    public static boolean isPultItem(ItemStack stack, PultKeys keys) {
        if (stack == null || !stack.hasItemMeta()) {
            return false;
        }
        return stack.getItemMeta().getPersistentDataContainer()
                .has(keys.item, PersistentDataType.BYTE);
    }
}
