package dev.nonether;

import io.papermc.paper.plugin.lifecycle.event.LifecycleEventManager;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import org.bukkit.plugin.java.JavaPlugin;

public final class NoNetherPlugin extends JavaPlugin {

    private volatile NoNetherConfig settings;

    @Override
    @SuppressWarnings("UnstableApiUsage")
    public void onEnable() {
        saveDefaultConfig();
        this.settings = NoNetherConfig.load(getConfig());

        getServer().getPluginManager().registerEvents(new NetherEntryListener(this), this);

        LifecycleEventManager<org.bukkit.plugin.Plugin> lifecycle = getLifecycleManager();
        lifecycle.registerEventHandler(LifecycleEvents.COMMANDS, event -> event.registrar()
                .register(NoNetherCommand.build(this), "Manage the NoNether plugin"));
    }

    NoNetherConfig settings() {
        return settings;
    }

    /**
     * Re-reads config.yml from disk and swaps in the new settings.
     */
    void reloadSettings() {
        reloadConfig();
        this.settings = NoNetherConfig.load(getConfig());
    }
}
