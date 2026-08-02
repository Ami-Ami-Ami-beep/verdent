package dev.nonether;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.configuration.file.FileConfiguration;
import org.jetbrains.annotations.Nullable;

import java.util.Locale;

/**
 * Immutable snapshot of config.yml. Rebuilt on every reload so the listener
 * never has to touch the configuration file at event time.
 */
record NoNetherConfig(
        @Nullable Component message,
        MessageTarget messageTarget,
        long messageCooldownMillis,
        boolean blockEntities,
        boolean blockPluginTeleports,
        boolean respectBypassPermission
) {

    enum MessageTarget {
        CHAT,
        ACTION_BAR,
        NONE
    }

    static NoNetherConfig load(FileConfiguration source) {
        String raw = source.getString("message", "");
        Component message = raw.isBlank() ? null : MiniMessage.miniMessage().deserialize(raw);

        MessageTarget target;
        String rawTarget = source.getString("message-target", "ACTION_BAR");
        try {
            target = MessageTarget.valueOf(rawTarget.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            target = MessageTarget.ACTION_BAR;
        }

        long cooldown = Math.max(0L, source.getLong("message-cooldown-seconds", 3L)) * 1000L;

        return new NoNetherConfig(
                message,
                target,
                cooldown,
                source.getBoolean("block-entities", true),
                source.getBoolean("block-plugin-teleports", true),
                source.getBoolean("respect-bypass-permission", true)
        );
    }

    boolean hasMessage() {
        return message != null && messageTarget != MessageTarget.NONE;
    }
}
