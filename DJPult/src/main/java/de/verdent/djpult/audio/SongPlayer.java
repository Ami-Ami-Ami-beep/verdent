package de.verdent.djpult.audio;

import de.verdent.djpult.nbs.Song;
import de.verdent.djpult.pult.DJPult;

/**
 * Playback state of a single deck. Advancing and sound emission live in {@link PlaybackManager};
 * this class only keeps track of where in the song the deck currently is.
 */
public final class SongPlayer {

    public enum State {
        PLAYING,
        PAUSED,
        STOPPED
    }

    private final DJPult pult;

    private Song song;
    private State state = State.STOPPED;
    /** Fractional song ticks carried over between server ticks. */
    private double cursor;
    private int tick = -1;

    SongPlayer(DJPult pult) {
        this.pult = pult;
    }

    public DJPult pult() {
        return pult;
    }

    public Song song() {
        return song;
    }

    public State state() {
        return state;
    }

    public boolean isPlaying() {
        return state == State.PLAYING && song != null;
    }

    public boolean isPaused() {
        return state == State.PAUSED;
    }

    public int tick() {
        return Math.max(0, tick);
    }

    /** Start a song from the beginning. */
    public void play(Song song) {
        this.song = song;
        this.state = State.PLAYING;
        this.cursor = 0;
        this.tick = -1;
    }

    /** Restart the current song without changing it. */
    public void restart() {
        if (song != null) {
            play(song);
        }
    }

    public void pause() {
        if (state == State.PLAYING) {
            state = State.PAUSED;
        }
    }

    public void resume() {
        if (state == State.PAUSED && song != null) {
            state = State.PLAYING;
        }
    }

    /** Toggles between playing and paused, starting the given song when nothing is loaded. */
    public void togglePause() {
        switch (state) {
            case PLAYING -> pause();
            case PAUSED -> resume();
            case STOPPED -> restart();
        }
    }

    public void stop() {
        state = State.STOPPED;
        cursor = 0;
        tick = -1;
    }

    /** Progress through the current song between 0 and 1. */
    public double progress() {
        if (song == null || song.length() <= 0) {
            return 0;
        }
        return Math.min(1.0, tick() / (double) song.length());
    }

    public double elapsedSeconds() {
        return song == null ? 0 : tick() / song.ticksPerSecond();
    }

    double cursor() {
        return cursor;
    }

    void setCursor(double cursor) {
        this.cursor = cursor;
    }

    int rawTick() {
        return tick;
    }

    void setTick(int tick) {
        this.tick = tick;
    }
}
