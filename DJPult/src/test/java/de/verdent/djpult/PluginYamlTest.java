package de.verdent.djpult;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the parts of plugin.yml the server validates while loading.
 *
 * <p>These are runtime checks on the server's side, so a compiling build says
 * nothing about them: a malformed api-version builds perfectly and then refuses
 * to load with "API version string should be of format major.minor.patch".</p>
 */
class PluginYamlTest {

    private static final Pattern API_VERSION =
            Pattern.compile("(?m)^api-version:\\s*['\"]?([^'\"\\s#]+)['\"]?\\s*$");
    private static final Pattern MAIN =
            Pattern.compile("(?m)^main:\\s*(\\S+)\\s*$");
    /** What org.bukkit.craftbukkit.util.ApiVersion accepts. */
    private static final Pattern MAJOR_MINOR_PATCH = Pattern.compile("\\d+\\.\\d+(\\.\\d+)?");

    private String pluginYaml() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/plugin.yml")) {
            assertNotNull(in, "plugin.yml is missing from the plugin resources");
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void declaresAnApiVersionTheServerCanParse() throws IOException {
        Matcher matcher = API_VERSION.matcher(pluginYaml());
        assertTrue(matcher.find(), "plugin.yml declares no api-version");

        String value = matcher.group(1);
        assertTrue(MAJOR_MINOR_PATCH.matcher(value).matches(),
                "api-version '" + value + "' is not major.minor or major.minor.patch, "
                        + "so the server refuses to load the plugin");
    }

    @Test
    void pointsAtAMainClassThatIsActuallyThere() throws IOException {
        Matcher matcher = MAIN.matcher(pluginYaml());
        assertTrue(matcher.find(), "plugin.yml declares no main class");

        // Looked up as a resource rather than with Class.forName: loading it would
        // pull in JavaPlugin, and the server API is compileOnly, so it is absent
        // from the test runtime.
        String resource = "/" + matcher.group(1).replace('.', '/') + ".class";
        assertNotNull(getClass().getResourceAsStream(resource),
                "plugin.yml points at " + matcher.group(1) + ", which is not in the build output");
    }
}
