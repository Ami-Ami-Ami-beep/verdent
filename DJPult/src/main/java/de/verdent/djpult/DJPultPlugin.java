package de.verdent.djpult;

import de.verdent.djpult.audio.PlaybackManager;
import de.verdent.djpult.audio.SongPlayer;
import de.verdent.djpult.command.DJPultCommand;
import de.verdent.djpult.config.PultConfig;
import de.verdent.djpult.gui.DJPultGui;
import de.verdent.djpult.listener.GuiListener;
import de.verdent.djpult.listener.PultListener;
import de.verdent.djpult.pult.DJPult;
import de.verdent.djpult.pult.PultKeys;
import de.verdent.djpult.pult.PultManager;
import de.verdent.djpult.song.SongLibrary;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.entity.Player;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.UUID;
import java.util.function.Supplier;

public final class DJPultPlugin extends JavaPlugin {

    /** How often an open control panel redraws while a song is running, in server ticks. */
    private static final long GUI_REFRESH_TICKS = 10L;

    private PultConfig config;
    private PultKeys keys;
    private SongLibrary library;
    private PultManager pultManager;
    private PlaybackManager playback;
    private BukkitTask guiRefreshTask;

    @Override
    public void onEnable() {
        config = new PultConfig(this);
        keys = new PultKeys(this);

        library = new SongLibrary(this);
        library.reloadNow();

        pultManager = new PultManager(this, config, keys);
        playback = new PlaybackManager(this, config, library);
        playback.start();

        getServer().getPluginManager().registerEvents(new PultListener(this), this);
        getServer().getPluginManager().registerEvents(new GuiListener(this), this);

        PluginCommand command = getCommand("djpult");
        if (command != null) {
            DJPultCommand executor = new DJPultCommand(this);
            command.setExecutor(executor);
            command.setTabCompleter(executor);
        } else {
            getLogger().severe("Command 'djpult' is missing from plugin.yml, commands are disabled.");
        }

        guiRefreshTask = Bukkit.getScheduler().runTaskTimer(this, this::refreshOpenGuis,
                GUI_REFRESH_TICKS, GUI_REFRESH_TICKS);
    }

    @Override
    public void onDisable() {
        if (guiRefreshTask != null) {
            guiRefreshTask.cancel();
            guiRefreshTask = null;
        }
        if (playback != null) {
            playback.shutdown();
        }
    }

    /** Logs only when debug is on; the message is built lazily so it costs nothing otherwise. */
    public void debug(Supplier<String> message) {
        if (config != null && config.debug()) {
            getLogger().info("[debug] " + message.get());
        }
    }

    public PultConfig pultConfig() {
        return config;
    }

    public PultKeys keys() {
        return keys;
    }

    public SongLibrary library() {
        return library;
    }

    public PultManager pultManager() {
        return pultManager;
    }

    public PlaybackManager playback() {
        return playback;
    }

    /** Rereads config.yml and the song folder; {@code whenDone} runs once the songs are live. */
    public void reloadEverything(Runnable whenDone) {
        config.reload();
        playback.clearCaches();
        library.reloadAsync(whenDone);
    }

    public void openGui(Player player, DJPult pult) {
        if (!mayControl(player, pult)) {
            player.sendMessage(config.message("no-permission-control"));
            return;
        }
        player.openInventory(new DJPultGui(this, pult).getInventory());
    }

    /** Whether a player may operate this deck. */
    public boolean mayControl(Player player, DJPult pult) {
        if (!player.hasPermission("djpult.use")) {
            return false;
        }
        if (!config.restrictControlsToOwner() || player.hasPermission("djpult.admin")) {
            return true;
        }
        UUID owner = pult.owner();
        return owner == null || owner.equals(player.getUniqueId());
    }

    /** Whether a player may take this deck down. Always limited to the owner and admins. */
    public boolean mayBreak(Player player, DJPult pult) {
        if (player.hasPermission("djpult.admin")) {
            return true;
        }
        UUID owner = pult.owner();
        return owner == null || owner.equals(player.getUniqueId());
    }

    /** Keeps the progress bar of open panels moving. */
    private void refreshOpenGuis() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            InventoryHolder holder = player.getOpenInventory().getTopInventory().getHolder();
            if (!(holder instanceof DJPultGui gui) || !gui.pult().isValid()) {
                continue;
            }
            playback.existing(gui.pult())
                    .filter(SongPlayer::isPlaying)
                    .ifPresent(songPlayer -> gui.render());
        }
    }
}
