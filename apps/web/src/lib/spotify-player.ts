"use client";

/**
 * Spotify Web Playback SDK integration
 *
 * Requirements:
 * - User must have Spotify Premium
 * - Browser-based playback
 * - Returns normalized PlayerState for sync engine
 */

export interface PlayerState {
  isrc: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  trackName: string;
  artistName: string;
}

export interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (state: any) => void) => void;
  removeListener: (event: string, callback?: (state: any) => void) => void;
  getCurrentState: () => Promise<Spotify.PlaybackState | null>;
  togglePlay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export class WebPlaybackSDK {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private accessToken: string | null = null;
  private onStateChange: ((state: PlayerState) => void) | null = null;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Load Spotify Web Playback SDK script
   */
  static loadSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Spotify) {
        resolve();
        return;
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        resolve();
      };

      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
      document.body.appendChild(script);
    });
  }

  /**
   * Initialize player and connect
   */
  async initialize(onStateChange: (state: PlayerState) => void): Promise<string> {
    if (!window.Spotify) {
      throw new Error("Spotify SDK not loaded");
    }

    this.onStateChange = onStateChange;

    this.player = new window.Spotify.Player({
      name: "LinerNotes Experience",
      getOAuthToken: (cb) => {
        if (this.accessToken) {
          cb(this.accessToken);
        }
      },
      volume: 0.8,
    });

    // Set up event listeners
    this.player.addListener("ready", ({ device_id }: { device_id: string }) => {
      console.log("[Spotify Player] Ready with Device ID:", device_id);
      this.deviceId = device_id;
    });

    this.player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
      console.log("[Spotify Player] Device ID has gone offline:", device_id);
    });

    this.player.addListener("player_state_changed", (state: Spotify.PlaybackState | null) => {
      if (!state) return;
      this.handleStateChange(state);
    });

    // Connect to Spotify
    const connected = await this.player.connect();
    if (!connected) {
      throw new Error("Failed to connect to Spotify");
    }

    // Wait for device ID
    return new Promise((resolve, reject) => {
      const checkDevice = setInterval(() => {
        if (this.deviceId) {
          clearInterval(checkDevice);
          resolve(this.deviceId);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkDevice);
        reject(new Error("Timeout waiting for device ID"));
      }, 5000);
    });
  }

  /**
   * Handle Spotify state changes and normalize to PlayerState
   */
  private handleStateChange(state: Spotify.PlaybackState) {
    const track = state.track_window.current_track;

    const playerState: PlayerState = {
      isrc: track.linked_from?.uri || track.uri || null,
      positionMs: state.position,
      durationMs: state.duration,
      isPlaying: !state.paused,
      trackName: track.name,
      artistName: track.artists.map((a) => a.name).join(", "),
    };

    if (this.onStateChange) {
      this.onStateChange(playerState);
    }
  }

  /**
   * Play a track by Spotify URI
   */
  async playTrack(spotifyUri: string): Promise<void> {
    if (!this.deviceId || !this.accessToken) {
      throw new Error("Player not initialized");
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        uris: [spotifyUri],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to play track: ${response.statusText}`);
    }
  }

  /**
   * Toggle play/pause
   */
  async togglePlay(): Promise<void> {
    if (this.player) {
      await this.player.togglePlay();
    }
  }

  /**
   * Seek to position
   */
  async seek(positionMs: number): Promise<void> {
    if (this.player) {
      await this.player.seek(positionMs);
    }
  }

  /**
   * Get current state
   */
  async getCurrentState(): Promise<PlayerState | null> {
    if (!this.player) return null;

    const state = await this.player.getCurrentState();
    if (!state) return null;

    const track = state.track_window.current_track;

    return {
      isrc: track.linked_from?.uri || track.uri || null,
      positionMs: state.position,
      durationMs: state.duration,
      isPlaying: !state.paused,
      trackName: track.name,
      artistName: track.artists.map((a) => a.name).join(", "),
    };
  }

  /**
   * Disconnect player
   */
  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
    }
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }
}
