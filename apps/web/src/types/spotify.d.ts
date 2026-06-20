/**
 * TypeScript definitions for Spotify Web Playback SDK
 * https://developer.spotify.com/documentation/web-playback-sdk/reference/
 */

declare namespace Spotify {
  interface Player {
    new (options: PlayerOptions): Player;
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (state: any) => void): void;
    removeListener(event: string): void;
    getCurrentState(): Promise<PlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    activateElement(): Promise<void>;
  }

  interface PlayerOptions {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }

  interface PlaybackState {
    context: {
      uri: string;
      metadata: Record<string, any>;
    };
    disallows: {
      pausing: boolean;
      peeking_next: boolean;
      peeking_prev: boolean;
      resuming: boolean;
      seeking: boolean;
      skipping_next: boolean;
      skipping_prev: boolean;
    };
    paused: boolean;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: {
      current_track: Track;
      previous_tracks: Track[];
      next_tracks: Track[];
    };
    duration: number;
  }

  interface Track {
    uri: string;
    id: string;
    type: string;
    media_type: string;
    name: string;
    is_playable: boolean;
    album: {
      uri: string;
      name: string;
      images: Image[];
    };
    artists: Artist[];
    linked_from?: {
      uri: string;
      id: string;
    };
  }

  interface Artist {
    uri: string;
    name: string;
  }

  interface Image {
    url: string;
    height: number;
    width: number;
  }

  interface Error {
    message: string;
  }
}

interface Window {
  Spotify: {
    Player: typeof Spotify.Player;
  };
  onSpotifyWebPlaybackSDKReady: () => void;
}
