package de.verdent.djpult.command;

import de.verdent.djpult.DJPultPlugin;
import de.verdent.djpult.audio.SongPlayer;
import de.verdent.djpult.nbs.Song;
import de.verdent.djpult.pult.DJPult;
import de.verdent.djpult.pult.PultItem;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** {@code /djpult} — hands out the deck item and offers a few shortcuts for testing. */
public final class DJPultCommand implements TabExecutor {

    /** How far a command may reach to find the deck it should act on. */
    private static final double REACH = 16.0;

    private final DJPultPlugin plugin;

    public DJPultCommand(DJPultPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sendUsage(sender);
            return true;
        }

        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "give" -> give(sender, args);
            case "list" -> list(sender);
            case "play" -> play(sender, args);
            case "stop" -> stop(sender);
            case "stopall" -> stopAll(sender);
            case "reload" -> reload(sender);
            default -> sendUsage(sender);
        }
        return true;
    }

    private void give(CommandSender sender, String[] args) {
        if (!sender.hasPermission("djpult.admin")) {
            sender.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        Player target;
        if (args.length > 1) {
            target = Bukkit.getPlayerExact(args[1]);
            if (target == null) {
                sender.sendMessage(plugin.pultConfig().message("player-not-found", "player", args[1]));
                return;
            }
        } else if (sender instanceof Player player) {
            target = player;
        } else {
            sender.sendMessage(plugin.pultConfig().message("player-only"));
            return;
        }

        ItemStack item = PultItem.create(plugin.pultConfig(), plugin.keys());
        target.getInventory().addItem(item).values()
                .forEach(leftover -> target.getWorld().dropItemNaturally(target.getLocation(), leftover));
        sender.sendMessage(plugin.pultConfig().message("given", "player", target.getName()));
    }

    private void list(CommandSender sender) {
        if (!sender.hasPermission("djpult.use")) {
            sender.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        List<Song> songs = plugin.library().songs();
        sender.sendMessage(plugin.pultConfig().message("song-list-header",
                "count", String.valueOf(songs.size())));
        for (Song song : songs) {
            sender.sendMessage(plugin.pultConfig().message("song-list-entry",
                    "id", song.id(),
                    "title", song.title(),
                    "author", song.author()));
        }
    }

    private void play(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.pultConfig().message("player-only"));
            return;
        }
        if (!player.hasPermission("djpult.use")) {
            player.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        if (args.length < 2) {
            sendUsage(sender);
            return;
        }

        String query = String.join(" ", Arrays.copyOfRange(args, 1, args.length));
        Optional<Song> song = plugin.library().find(query);
        if (song.isEmpty()) {
            player.sendMessage(plugin.pultConfig().message("song-not-found", "song", query));
            return;
        }
        Optional<DJPult> pult = plugin.pultManager().nearest(player.getLocation(), REACH);
        if (pult.isEmpty()) {
            player.sendMessage(plugin.pultConfig().message("no-deck-nearby"));
            return;
        }
        if (!plugin.mayControl(player, pult.get())) {
            player.sendMessage(plugin.pultConfig().message("no-permission-control"));
            return;
        }

        SongPlayer songPlayer = plugin.playback().playerFor(pult.get());
        songPlayer.play(song.get());
        pult.get().setSongId(song.get().id());
        player.sendMessage(plugin.pultConfig().message("now-playing", "song", song.get().title()));
    }

    private void stop(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.pultConfig().message("player-only"));
            return;
        }
        if (!player.hasPermission("djpult.use")) {
            player.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        Optional<DJPult> pult = plugin.pultManager().nearest(player.getLocation(), REACH);
        if (pult.isEmpty()) {
            player.sendMessage(plugin.pultConfig().message("no-deck-nearby"));
            return;
        }
        if (!plugin.mayControl(player, pult.get())) {
            player.sendMessage(plugin.pultConfig().message("no-permission-control"));
            return;
        }
        plugin.playback().playerFor(pult.get()).stop();
        player.sendMessage(plugin.pultConfig().message("stopped"));
    }

    private void stopAll(CommandSender sender) {
        if (!sender.hasPermission("djpult.admin")) {
            sender.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        int playing = plugin.playback().playingCount();
        plugin.playback().stopAll();
        sender.sendMessage(plugin.pultConfig().message("stopped-all", "count", String.valueOf(playing)));
    }

    private void reload(CommandSender sender) {
        if (!sender.hasPermission("djpult.admin")) {
            sender.sendMessage(plugin.pultConfig().message("no-permission"));
            return;
        }
        plugin.reloadEverything(() -> sender.sendMessage(plugin.pultConfig().message("reloaded",
                "count", String.valueOf(plugin.library().songs().size()))));
    }

    private void sendUsage(CommandSender sender) {
        sender.sendMessage(plugin.pultConfig().message("usage"));
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 1) {
            List<String> options = new ArrayList<>(List.of("list", "play", "stop"));
            if (sender.hasPermission("djpult.admin")) {
                options.addAll(List.of("give", "stopall", "reload"));
            }
            return filter(options, args[0]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("play")) {
            return filter(plugin.library().songs().stream().map(Song::id).toList(), args[1]);
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("give")) {
            return filter(Bukkit.getOnlinePlayers().stream().map(Player::getName).toList(), args[1]);
        }
        return List.of();
    }

    private static List<String> filter(List<String> options, String prefix) {
        String needle = prefix.toLowerCase(Locale.ROOT);
        return options.stream().filter(option -> option.toLowerCase(Locale.ROOT).startsWith(needle)).toList();
    }
}
