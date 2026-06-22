/**
 * Last.fm API Integration
 * For scrobble tracking and now-playing detection
 * Based on LINERNOTES_LASTFM_INTEGRATION.md
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Crypto } from 'expo-crypto';

const LASTFM_API_KEY = '27c8a2cf77248d10bbfb17a999b2173a'; // Hardcoded for now to avoid React Native env issues
const LASTFM_SHARED_SECRET = 'd4a207d299345c372c245665d728159f'; // Last.fm API shared secret
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_SESSION_KEY = '@linernotes:lastfm_session';
const LASTFM_USERNAME_KEY = '@linernotes:lastfm_username';

/** Last.fm returns image arrays as [{ size, '#text' }]. */
export interface LastFmImage {
  size?: string;
  '#text'?: string;
}

export interface LastFmTrack {
  artist: string;
  name: string;
  /** Last.fm returns album either as a plain string or as { '#text' } */
  album?: string | { '#text': string };
  /** Raw artwork variants (present on un-normalized API responses) */
  image?: LastFmImage[];
  mbid?: string;
  date?: {
    uts: string; // Unix timestamp
    '#text': string;
  };
  /** Present on the currently-playing item: { nowplaying: 'true' } */
  '@attr'?: { nowplaying?: string };
  nowplaying?: string;
}

export interface LastFmRecentTracksResponse {
  recenttracks: {
    track: LastFmTrack[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      total: string;
      perPage: string;
    };
  };
}

// Last.fm serves this placeholder star image when it has no real artwork.
export const LASTFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

/** Pick the largest real image URL from a Last.fm image array (or null). */
export function pickLastFmImage(images: any): string | null {
  if (!Array.isArray(images)) return null;
  const bySize = (s: string) => images.find((i: any) => i?.size === s)?.['#text'];
  const url =
    bySize('mega') ||
    bySize('extralarge') ||
    bySize('large') ||
    bySize('medium') ||
    images[images.length - 1]?.['#text'] ||
    '';
  if (!url || url.includes(LASTFM_PLACEHOLDER)) return null;
  return url;
}

class LastFmService {
  private client: AxiosInstance;
  private sessionKey: string | null = null;
  private username: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: LASTFM_API_URL,
      timeout: 10000,
    });
  }

  /**
   * Initialize Last.fm session
   */
  async initialize() {
    this.sessionKey = await AsyncStorage.getItem(LASTFM_SESSION_KEY);
    this.username = await AsyncStorage.getItem(LASTFM_USERNAME_KEY);
  }

  /**
   * Set Last.fm session key
   */
  async setSessionKey(sessionKey: string) {
    this.sessionKey = sessionKey;
    await AsyncStorage.setItem(LASTFM_SESSION_KEY, sessionKey);
  }

  /**
   * Set Last.fm username (called when user connects)
   */
  async setUsername(username: string) {
    this.username = username;
    await AsyncStorage.setItem(LASTFM_USERNAME_KEY, username);
  }

  /**
   * Get stored Last.fm username
   */
  async getUsername(): Promise<string | null> {
    if (!this.username) {
      this.username = await AsyncStorage.getItem(LASTFM_USERNAME_KEY);
    }
    return this.username;
  }

  /**
   * Check if user has connected Last.fm
   */
  async isConnected(): Promise<boolean> {
    const username = await this.getUsername();
    return username !== null;
  }

  /**
   * Clear Last.fm session
   */
  async clearSession() {
    this.sessionKey = null;
    this.username = null;
    await AsyncStorage.removeItem(LASTFM_SESSION_KEY);
    await AsyncStorage.removeItem(LASTFM_USERNAME_KEY);
  }

  /**
   * Disconnect Last.fm by clearing the stored username (and session).
   * Alias of clearSession kept for callers that disconnect by username.
   */
  async clearUsername() {
    await this.clearSession();
  }

  /**
   * Generate API signature for authenticated requests
   * Last.fm requires signing authenticated requests with MD5(params + secret)
   */
  private async generateSignature(params: Record<string, string>): Promise<string> {
    // Sort params alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    const sigString = sortedKeys.map(key => `${key}${params[key]}`).join('') + LASTFM_SHARED_SECRET;

    // Generate MD5 hash
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.MD5,
      sigString
    );

    return digest;
  }

  /**
   * Step 1: Get an authentication token from Last.fm
   * This token is used to build the auth URL
   */
  async getAuthToken(): Promise<string> {
    try {
      const params = {
        method: 'auth.getToken',
        api_key: LASTFM_API_KEY,
      };

      const signature = await this.generateSignature(params);

      const { data } = await this.client.get('', {
        params: {
          ...params,
          api_sig: signature,
          format: 'json',
        },
      });

      if (!data.token) {
        throw new Error('No token returned from Last.fm');
      }

      return data.token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw error;
    }
  }

  /**
   * Step 2: Generate the Last.fm authorization URL
   * User must visit this URL to authorize the app
   */
  getAuthUrl(token: string): string {
    return `https://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&token=${token}`;
  }

  /**
   * Step 3: Exchange the authorized token for a session key
   * Call this after user has authorized the app
   */
  async getSessionKey(token: string): Promise<{ sessionKey: string; username: string }> {
    try {
      const params = {
        method: 'auth.getSession',
        api_key: LASTFM_API_KEY,
        token,
      };

      const signature = await this.generateSignature(params);

      const { data } = await this.client.get('', {
        params: {
          ...params,
          api_sig: signature,
          format: 'json',
        },
      });

      if (!data.session) {
        throw new Error('No session returned from Last.fm');
      }

      const sessionKey = data.session.key;
      const username = data.session.name;

      // Store the session key and username
      await this.setSessionKey(sessionKey);
      await this.setUsername(username);

      return { sessionKey, username };
    } catch (error) {
      console.error('Failed to get session key:', error);
      throw error;
    }
  }

  /**
   * Get recent tracks for a user
   */
  async getRecentTracks(username: string, limit: number = 10): Promise<LastFmTrack[]> {
    try {
      const { data } = await this.client.get<LastFmRecentTracksResponse>('', {
        params: {
          method: 'user.getrecenttracks',
          user: username,
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit,
        },
      });

      // Normalize: Last.fm returns artist/album as objects ({ '#text' }); the
      // rest of the app expects plain strings.
      return (data.recenttracks?.track || []).map((t: any) => ({
        ...t,
        artist:
          typeof t.artist === 'string' ? t.artist : t.artist?.['#text'] || t.artist?.name || '',
        album: typeof t.album === 'string' ? t.album : t.album?.['#text'] || '',
      }));
    } catch (error) {
      console.error('Failed to get recent tracks:', error);
      throw error;
    }
  }

  /**
   * Get currently playing track
   */
  async getNowPlaying(username: string): Promise<LastFmTrack | null> {
    try {
      const tracks = await this.getRecentTracks(username, 1);
      const nowPlaying = tracks.find((track) => track.nowplaying === 'true');
      return nowPlaying || null;
    } catch (error) {
      console.error('Failed to get now playing:', error);
      return null;
    }
  }

  /**
   * Poll for now-playing updates
   * Returns a cleanup function to stop polling
   */
  startNowPlayingPoll(
    username: string,
    onUpdate: (track: LastFmTrack | null) => void,
    intervalMs: number = 10000 // Poll every 10 seconds
  ): () => void {
    let lastTrack: LastFmTrack | null = null;

    const poll = async () => {
      try {
        const nowPlaying = await this.getNowPlaying(username);

        // Only call onUpdate if the track changed
        const trackChanged =
          (!lastTrack && nowPlaying) ||
          (lastTrack && !nowPlaying) ||
          (lastTrack && nowPlaying &&
           (lastTrack.name !== nowPlaying.name || lastTrack.artist !== nowPlaying.artist));

        if (trackChanged) {
          lastTrack = nowPlaying;
          onUpdate(nowPlaying);
        }
      } catch (error) {
        console.error('Now playing poll error:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, intervalMs);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Best album artwork URL for a track, via Last.fm track.getInfo.
   * Returns null when Last.fm has no real cover (filters its placeholder star).
   */
  async getTrackArtwork(artist: string, track: string): Promise<string | null> {
    const attempt = async (t: string): Promise<string | null> => {
      try {
        const info = await this.getTrackInfo(artist, t);
        return pickLastFmImage(info?.album?.image);
      } catch {
        return null;
      }
    };
    let art = await attempt(track);
    if (!art) {
      // Retry with remix/feat/version suffixes stripped (Last.fm indexes the base).
      const cleaned = track
        .replace(/\s*[-(\[]\s*(feat\.?|ft\.?|remix|edit|version|remaster(ed)?|live|acoustic|extended|radio|mix|bonus|deluxe).*/i, '')
        .trim();
      if (cleaned && cleaned.toLowerCase() !== track.toLowerCase()) {
        art = await attempt(cleaned);
      }
    }
    return art;
  }

  /**
   * Best album artwork URL via Last.fm album.getInfo.
   */
  async getAlbumArtwork(artist: string, album: string): Promise<string | null> {
    try {
      const info = await this.getAlbumInfo(artist, album);
      return pickLastFmImage(info?.image);
    } catch {
      return null;
    }
  }

  /**
   * Get track info (for metadata enrichment)
   */
  async getTrackInfo(artist: string, track: string, username?: string) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'track.getInfo',
          api_key: LASTFM_API_KEY,
          artist,
          track,
          username,
          autocorrect: 1,
          format: 'json',
        },
      });

      return data.track;
    } catch (error) {
      console.error('Failed to get track info:', error);
      throw error;
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(query: string, limit: number = 10) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'track.search',
          api_key: LASTFM_API_KEY,
          track: query,
          limit,
          format: 'json',
        },
      });

      return data.results?.trackmatches?.track || [];
    } catch (error) {
      console.error('Failed to search tracks:', error);
      throw error;
    }
  }

  /**
   * Get top tracks for asking engine detection
   * Returns tracks played most in a time period
   */
  async getTopTracks(username: string, period: '7day' | '1month' | '3month' | '6month' = '7day', limit: number = 50) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'user.gettoptracks',
          user: username,
          api_key: LASTFM_API_KEY,
          period,
          limit,
          format: 'json',
        },
      });

      return data.toptracks?.track || [];
    } catch (error) {
      console.error('Failed to get top tracks:', error);
      throw error;
    }
  }

  /**
   * Get top albums for asking engine detection
   */
  async getTopAlbums(username: string, period: '7day' | '1month' | '3month' | '6month' = '7day', limit: number = 50) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'user.gettopalbums',
          user: username,
          api_key: LASTFM_API_KEY,
          period,
          limit,
          format: 'json',
        },
      });

      return data.topalbums?.album || [];
    } catch (error) {
      console.error('Failed to get top albums:', error);
      throw error;
    }
  }

  /**
   * Get album info to detect full-album listens
   */
  async getAlbumInfo(artist: string, album: string, username?: string) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'album.getInfo',
          api_key: LASTFM_API_KEY,
          artist,
          album,
          username,
          autocorrect: 1,
          format: 'json',
        },
      });

      return data.album;
    } catch (error) {
      console.error('Failed to get album info:', error);
      throw error;
    }
  }
}

export const lastfm = new LastFmService();
