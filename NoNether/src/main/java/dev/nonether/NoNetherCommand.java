package dev.nonether;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.tree.LiteralCommandNode;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;

@SuppressWarnings("UnstableApiUsage")
final class NoNetherCommand {

    private NoNetherCommand() {
    }

    static LiteralCommandNode<CommandSourceStack> build(NoNetherPlugin plugin) {
        return Commands.literal("nonether")
                .requires(source -> source.getSender().hasPermission("nonether.admin"))
                .executes(context -> status(plugin, context.getSource()))
                .then(Commands.literal("status")
                        .executes(context -> status(plugin, context.getSource())))
                .then(Commands.literal("reload")
                        .executes(context -> {
                            plugin.reloadSettings();
                            context.getSource().getSender().sendMessage(
                                    Component.text("NoNether: config.yml reloaded.", NamedTextColor.GREEN));
                            return Command.SINGLE_SUCCESS;
                        }))
                .build();
    }

    private static int status(NoNetherPlugin plugin, CommandSourceStack source) {
        NoNetherConfig settings = plugin.settings();
        source.getSender().sendMessage(Component.text()
                .append(Component.text("NoNether", NamedTextColor.AQUA))
                .append(Component.text(" - entering the Nether is blocked.", NamedTextColor.GRAY))
                .append(Component.newline())
                .append(line("entities", settings.blockEntities()))
                .append(Component.newline())
                .append(line("plugin teleports", settings.blockPluginTeleports()))
                .append(Component.newline())
                .append(line("bypass permission", settings.respectBypassPermission()))
                .build());
        return Command.SINGLE_SUCCESS;
    }

    private static Component line(String label, boolean enabled) {
        return Component.text("  " + label + ": ", NamedTextColor.GRAY)
                .append(enabled
                        ? Component.text("blocked", NamedTextColor.GREEN)
                        : Component.text("allowed", NamedTextColor.YELLOW));
    }
}
