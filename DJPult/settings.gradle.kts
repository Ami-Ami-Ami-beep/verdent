plugins {
    // Lets Gradle fetch the Java 25 toolchain itself, so a fresh clone builds
    // without anyone having to install a matching JDK first.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "DJPult"
