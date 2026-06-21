/**
 * LinerNotes Composer Screen - Musicathon Edition
 * Three modes: Track / Album / Playlist
 * Uses Musicathon color palette (deep maroon bg, oxblood surfaces, gold accents)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/atoms/Icon';
import { Stars } from '../components/atoms/Stars';
import { ReactionIcon } from '../components/atoms/Reactions';
import { AlbumArt } from '../components/atoms/AlbumArt';
import { ReviewCard } from '../components/ReviewCard';
import { LyricsBrowser } from '../components/LyricsBrowser';
import { formatTimestamp } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { lastfm } from '../services/lastfm';
import { useAuth } from '../contexts/AuthContext';
import { reviewToFeedReview, playlistToFeedReview } from '../lib/feed-adapter';
import type { Moment, ReactionType } from '../lib/types';
import { tokens } from '../lib/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ComposerMode = 'track' | 'album' | 'playlist';

// Accept Spotify / Apple Music playlist links (and Spotify URIs).
function isPlaylistLink(url: string): boolean {
  const u = url.trim();
  return (
    /open\.spotify\.com\/playlist\//i.test(u) ||
    /spotify:playlist:/i.test(u) ||
    /music\.apple\.com\/[^/]+\/playlist\//i.test(u)
  );
}

// Art is unusable when it's missing, an unreliable Cover Art Archive URL
// (often 404s), or Last.fm's placeholder "grey star" — try a better source.
function needsBetterArt(url?: string): boolean {
  return (
    !url ||
    url.includes('coverartarchive.org') ||
    url.includes('2a96cbd8b46e442fc41c2b86b821562f')
  );
}

// Resolve a cover for a prompt-autofilled track/album: use the app's normal
// album-art source (the iTunes-backed music search) first, Last.fm last resort.
async function resolvePromptArtwork(
  artist: string,
  title: string,
  kind: 'track' | 'album'
): Promise<string | null> {
  const pickUrl = (r: any): string =>
    r?.artworkUrl || (r?.artworkUrl100 || '').replace('100x100', '600x600');
  try {
    const q = `${artist} ${title}`.trim();
    const data = kind === 'album' ? await api.searchAlbums(q, 5) : await api.searchTracks(q, 5);
    const hit = (data.results || []).find((r: any) => !needsBetterArt(pickUrl(r)));
    if (hit) return pickUrl(hit);
  } catch {
    /* fall through to Last.fm */
  }
  return kind === 'album'
    ? lastfm.getAlbumArtwork(artist, title).catch(() => null)
    : lastfm.getTrackArtwork(artist, title).catch(() => null);
}

function linkPlatform(url: string): string {
  if (/spotify/i.test(url)) return 'Spotify';
  if (/music\.apple\.com/i.test(url)) return 'Apple Music';
  return 'Playlist';
}

// Optional per-track reaction cycles none → flame → love → skip → none.
const REACTION_CYCLE: ReactionType[] = [null, 'flame', 'love', 'skip'];
function nextReaction(r: ReactionType): ReactionType {
  const i = REACTION_CYCLE.indexOf(r ?? null);
  return REACTION_CYCLE[(i + 1) % REACTION_CYCLE.length];
}

interface TrackData {
  n: number;
  name: string;
  artist?: string;
  reaction: ReactionType;
  review: string;
  moments: Moment[];
  excluded?: boolean;
}

interface MomentInput {
  mm: string;
  ss: string;
  note: string;
}

interface ComposerScreenProps {
  onClose: () => void;
  /** Called after a review/playlist is successfully posted (before onClose). */
  onPosted?: () => void;
  mode?: ComposerMode;
  prefilledTrack?: any;
  prefilledAlbum?: any;
  prefilledRating?: number;
}

export function ComposerScreen({
  onClose,
  onPosted,
  mode: initialMode = 'track',
  prefilledTrack,
  prefilledAlbum,
  prefilledRating,
}: ComposerScreenProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [rating, setRating] = useState(prefilledRating || 0);
  const [take, setTake] = useState('');
  const [soloMoments, setSoloMoments] = useState<Moment[]>([]);
  const [momentInputMode, setMomentInputMode] = useState<'manual' | 'lyrics'>('manual');
  const [isPosting, setIsPosting] = useState(false);
  const [showTake, setShowTake] = useState(false);
  const [showMoments, setShowMoments] = useState(false);
  const [showTracks, setShowTracks] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);

  // Album/Playlist track management
  const [tracks, setTracks] = useState<Record<number, TrackData>>({});
  // TODO: Implement track selection UI for album mode
  // const [openTrack, setOpenTrack] = useState<number | null>(null);
  // const [fullAlbum, setFullAlbum] = useState(false);

  // Track search (track mode) — its own box + state
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [searchingTrack, setSearchingTrack] = useState(false);

  // Album search (album mode) — separate box + state
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumResults, setAlbumResults] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [searchingAlbum, setSearchingAlbum] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<any[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Playlist (playlist mode) — name + external Spotify/Apple link + curated tracks
  const [playlistName, setPlaylistName] = useState('');
  const [playlistLink, setPlaylistLink] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [showPlaylistSearch, setShowPlaylistSearch] = useState(false);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);

  // The item the shared bits (rating, preview, post) act on.
  const selectedItem = mode === 'album' ? selectedAlbum : selectedTrack;

  const gold = tokens.colors.gold;
  const scrollRef = useRef<ScrollView>(null);
  const scrollToInput = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

  const lines = take.split('\n').filter(l => l.trim());
  // When the take is multi-line the user picks which line is the caption (the
  // line shown on the card); we store the take with that line hoisted first so
  // the card preview shows the caption and the experience shows the full text.
  const captionIdx = lines.length ? Math.min(captionIndex, lines.length - 1) : 0;
  const orderedTake =
    lines.length > 1
      ? [lines[captionIdx], ...lines.filter((_, i) => i !== captionIdx)].join('\n')
      : take.trim();
  const preview = lines[captionIdx] || '';
  const hasBody = lines.length > 1;
  const depth = hasBody ? 'full' : preview ? 'caption' : rating > 0 ? 'floor' : null;

  const canPost =
    mode === 'playlist'
      ? playlistName.trim().length > 0 && playlistTracks.length > 0
      : !!selectedItem && rating > 0;

  // Swipe down from the top (header): the sheet tracks the finger and snaps
  // closed past a threshold, otherwise springs back.
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 220,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 2,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Set prefilled track/album from feed prompts, and autofill the cover when
  // the prompt didn't carry one (album art first, Last.fm last resort).
  useEffect(() => {
    if (prefilledTrack) {
      setSelectedTrack(prefilledTrack);
      setMode('track');
      if (needsBetterArt(prefilledTrack.artworkUrl) && prefilledTrack.artist && prefilledTrack.name) {
        resolvePromptArtwork(prefilledTrack.artist, prefilledTrack.name, 'track').then((art) => {
          if (art) {
            setSelectedTrack((prev: any) =>
              prev && prev.id === prefilledTrack.id ? { ...prev, artworkUrl: art } : prev
            );
          }
        });
      }
    } else if (prefilledAlbum) {
      setSelectedAlbum(prefilledAlbum);
      setMode('album');
      const title = prefilledAlbum.album || prefilledAlbum.name;
      if (needsBetterArt(prefilledAlbum.artworkUrl) && prefilledAlbum.artist && title) {
        resolvePromptArtwork(prefilledAlbum.artist, title, 'album').then((art) => {
          if (art) {
            setSelectedAlbum((prev: any) =>
              prev && prev.id === prefilledAlbum.id ? { ...prev, artworkUrl: art } : prev
            );
          }
        });
      }
    }
  }, [prefilledTrack, prefilledAlbum]);

  // Live preview of the note — only once a song/album and rating are chosen.
  const previewReview =
    mode !== 'playlist' && selectedItem && rating > 0
      ? reviewToFeedReview(
          {
            id: 'preview',
            userId: user?.id ?? '',
            track: {
              id: String(selectedItem.id),
              name: selectedItem.name,
              artist: selectedItem.artist,
              album: selectedItem.album || '',
              artworkUrl: selectedItem.artworkUrl,
            },
            rating,
            take: orderedTake || undefined,
            notes: soloMoments,
            featuredNoteIdx: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { name: user?.displayName || 'You', handle: user?.handle || 'you', tint: gold }
        )
      : null;

  // Live preview of the playlist card while building it.
  const previewPlaylist =
    mode === 'playlist' && playlistName.trim().length > 0 && playlistTracks.length > 0
      ? playlistToFeedReview(
          {
            id: 'preview',
            title: playlistName.trim(),
            description: orderedTake || undefined,
            tracks: playlistTracks,
            createdAt: new Date().toISOString(),
          },
          { name: user?.displayName || 'You', handle: user?.handle || 'you', tint: gold }
        )
      : null;

  const previewCard = previewReview || previewPlaylist;

  // Debounce typing and guard against out-of-order responses: only the most
  // recent query (tracked by searchSeq) is allowed to write results, so a slow
  // stale response can't clobber the latest one.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  function queueSearch(query: string, kind: 'track' | 'album') {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const setResults = kind === 'album' ? setAlbumResults : setTrackResults;
    if (!query.trim()) {
      searchSeq.current++; // cancel any in-flight write
      setResults([]);
      (kind === 'album' ? setSearchingAlbum : setSearchingTrack)(false);
      return;
    }
    (kind === 'album' ? setSearchingAlbum : setSearchingTrack)(true);
    searchTimer.current = setTimeout(() => runSearch(query, kind), 350);
  }

  // Tries the backend (MusicBrainz + iTunes) first, falls back to iTunes.
  async function runSearch(query: string, kind: 'track' | 'album') {
    const setResults = kind === 'album' ? setAlbumResults : setTrackResults;
    const setBusy = kind === 'album' ? setSearchingAlbum : setSearchingTrack;
    const seq = ++searchSeq.current;
    try {
      let results: any[] = [];
      try {
        const data = kind === 'album'
          ? await api.searchAlbums(query, 10)
          : await api.searchTracks(query, 10);
        results = data.results || data || [];
      } catch {
        console.log('Backend search failed, falling back to iTunes API');
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${kind === 'album' ? 'album' : 'song'}&limit=10`
        );
        const data = await res.json();
        results = data.results || [];
      }
      if (seq === searchSeq.current) setResults(results); // latest query wins
    } catch (error) {
      console.error('Search failed:', error);
      if (seq === searchSeq.current) setResults([]);
    } finally {
      if (seq === searchSeq.current) setBusy(false);
    }
  }

  // Normalize a backend/iTunes result into our selected-item shape.
  const normalizeResult = (result: any) => ({
    id: String(result.id || result.albumId || result.trackId || result.collectionId),
    name: result.name || result.trackName || result.collectionName,
    artist: result.artist || result.artistName,
    album: result.album || result.collectionName,
    artworkUrl: result.artworkUrl || (result.artworkUrl100 || '').replace('100x100', '600x600'),
  });

  async function selectTrack(result: any) {
    const t = normalizeResult(result);
    setSelectedTrack(t);
    setTrackResults([]);
    setTrackQuery('');
    // No cover (or only an unreliable Cover Art Archive URL)? Use Last.fm.
    if (needsBetterArt(t.artworkUrl) && t.artist && t.name) {
      const art = await lastfm.getTrackArtwork(t.artist, t.name).catch(() => null);
      if (art) {
        setSelectedTrack((prev: any) => (prev && prev.id === t.id ? { ...prev, artworkUrl: art } : prev));
      }
    }
  }

  async function selectAlbum(result: any) {
    const a = normalizeResult(result);
    setSelectedAlbum(a);
    setAlbumResults([]);
    setAlbumQuery('');

    // No cover (or only an unreliable Cover Art Archive URL)? Use Last.fm.
    if (needsBetterArt(a.artworkUrl) && a.artist && (a.album || a.name)) {
      lastfm
        .getAlbumArtwork(a.artist, a.album || a.name)
        .then((art) => {
          if (art) setSelectedAlbum((prev: any) => (prev && prev.id === a.id ? { ...prev, artworkUrl: art } : prev));
        })
        .catch(() => {});
    }

    // If we have an album id, fetch its tracklist so the album review can
    // carry per-track entries.
    const albumId = result.albumId || result.id || result.collectionId;
    if (albumId) {
      setLoadingTracks(true);
      try {
        const { tracks: fetchedTracks } = await api.getAlbumTracks(String(albumId));
        setAlbumTracks(fetchedTracks || []);
        const tracksMap: Record<number, TrackData> = {};
        (fetchedTracks || []).forEach((track: any, index: number) => {
          const n = track.trackNumber || index + 1;
          tracksMap[n] = { n, name: track.name, moments: [], reaction: null, review: '' };
        });
        setTracks(tracksMap);
      } catch (error) {
        console.error('Failed to fetch album tracks:', error);
        setAlbumTracks([]);
      } finally {
        setLoadingTracks(false);
      }
    }
  }

  async function handlePost() {
    if (isPosting) return;

    setIsPosting(true);

    try {
      const body = hasBody ? orderedTake.split('\n').slice(1).join('\n') : undefined;

      if (mode === 'playlist') {
        await api.createPlaylist({
          title: playlistName.trim(),
          description: orderedTake || undefined,
          url: playlistLink.trim() || undefined,
          tracks: playlistTracks.map((t) => ({
            trackId: String(t.id),
            name: t.name,
            artist: t.artist,
            album: t.album || '',
            artworkUrl: t.artworkUrl || null,
            note: t.note,
            reaction: t.reaction ?? null,
          })),
        });
      } else if (mode === 'album') {
        await api.createAlbumReview({
          album: {
            id: selectedAlbum.id,
            name: selectedAlbum.name,
            artist: selectedAlbum.artist,
            artworkUrl: selectedAlbum.artworkUrl,
          },
          overallRating: rating,
          body,
          tracks: Object.values(tracks).map((t) => ({
            trackId: String(t.n),
            trackName: t.name,
            trackNumber: t.n,
            reaction: t.reaction,
            moment: t.moments[0],
            take: t.review || undefined,
          })),
          notes: soloMoments,
          featuredNoteIdx: 0,
        });
      } else {
        await api.createReview({
          track: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            artist: selectedTrack.artist,
            album: selectedTrack.album || '',
            artworkUrl: selectedTrack.artworkUrl,
          },
          rating,
          take: orderedTake || undefined,
          notes: soloMoments,
          featuredNoteIdx: 0,
        });
      }

      // Posted successfully — let the caller react (e.g. dismiss the prompt),
      // then close the composer without a confirmation popup.
      onPosted?.();
      onClose();
    } catch (error) {
      console.error('Failed to post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const what = mode === 'playlist' ? 'playlist' : mode === 'album' ? 'album review' : 'review';
      Alert.alert('Error', `Failed to post ${what}: ${errorMessage}`);
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <LinearGradient
        colors={[`${gold}1c`, 'transparent']}
        style={styles.headerGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              New {mode === 'playlist' ? 'playlist' : mode === 'track' ? 'track note' : 'album review'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={17} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Mode Tabs */}
          <View style={styles.modeTabs}>
            {(['track', 'album', 'playlist'] as ComposerMode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeTab, mode === m && { backgroundColor: gold }]}
              >
                <Text style={[
                  styles.modeTabText,
                  mode === m && styles.modeTabTextActive
                ]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Proposed content card (NOT search) */}
          {mode === 'playlist' ? (
            <View style={[styles.section, { marginTop: 16 }]}>
              <Text style={[styles.proposedLabel, { color: gold }]}>NAME YOUR PLAYLIST</Text>
              <TextInput
                style={[styles.playlistTitleInput, { borderColor: 'rgba(241,235,224,0.14)' }]}
                value={playlistName}
                onChangeText={setPlaylistName}
                placeholder="untitled playlist"
                placeholderTextColor="rgba(241,235,224,0.3)"
              />
              {/* Spotify/Apple Music link paste */}
              <View style={[styles.linkInputRow, { borderColor: 'rgba(241,235,224,0.1)' }]}>
                <Icon name="refresh-cw" size={15} color="rgba(241,235,224,0.5)" />
                <TextInput
                  style={styles.linkInput}
                  value={playlistLink}
                  onChangeText={setPlaylistLink}
                  placeholder="paste a Spotify / Apple playlist link"
                  placeholderTextColor="rgba(241,235,224,0.5)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {playlistLink.trim() && <Icon name="bookmark" size={14} color={gold} filled />}
              </View>
              <Text style={styles.linkHint}>
                paste your playlist link, then add the tracks you want to feature and annotate.
              </Text>
            </View>
          ) : (
            <View style={[styles.proposedCard, { borderColor: 'rgba(241,235,224,0.09)' }]}>
              <View style={styles.proposedArt}>
                <AlbumArt
                  palette={selectedTrack?.palette || selectedAlbum?.palette || { deep: '#3e1e20', mid: '#5a2e30', lo: '#2c1517', accent: gold, glow: gold }}
                  artworkUrl={selectedTrack?.artworkUrl || selectedAlbum?.artworkUrl}
                  label=""
                  size={58}
                  noTag
                />
              </View>
              <View style={styles.proposedInfo}>
                <Text style={[styles.proposedLabel, { color: gold }]}>
                  {mode === 'track' ? 'THE TRACK YOU JUST PLAYED' : 'BECAUSE YOU JUST LISTENED'}
                </Text>
                <Text style={styles.proposedTitle} numberOfLines={1}>
                  {selectedTrack?.name || selectedAlbum?.name || ''}
                </Text>
                <Text style={styles.proposedMeta} numberOfLines={1}>
                  {selectedTrack?.artist || selectedAlbum?.artist || ''}
                  {(selectedTrack?.album || selectedAlbum?.releaseDate) && ` · ${selectedTrack?.album || selectedAlbum?.releaseDate?.substring(0, 4)}`}
                </Text>
              </View>
              <TouchableOpacity style={styles.proposedChange}>
                <Icon name="refresh-cw" size={13} color="rgba(241,235,224,0.5)" />
                <Text style={styles.proposedChangeText}>change</Text>
              </TouchableOpacity>
            </View>
          )}


          {/* Playlist mode - track list with "add a track" button */}
          {mode === 'playlist' && playlistTracks.length > 0 && (
            <View style={[styles.tracksCard, { marginTop: 16, borderColor: 'rgba(241,235,224,0.1)' }]}>
              <View style={[styles.tracksHeader, { paddingVertical: 10 }]}>
                <Text style={styles.playlistTracksLabel}>
                  your tracks — react · bookmark a note or moment
                </Text>
              </View>
              {playlistTracks.map((track, index) => {
                const key = `pl-${track.id}`;
                return (
                  <EditableTrackRow
                    key={`${track.id}-${index}`}
                    number={index + 1}
                    name={track.name}
                    artist={track.artist}
                    reaction={track.reaction ?? null}
                    note={track.note || ''}
                    moments={track.moments || []}
                    noteOpen={noteEditingId === key}
                    gold={gold}
                    showArtist
                    onCycleReaction={() => {
                      setPlaylistTracks(prev => prev.map((t, i) =>
                        i === index ? { ...t, reaction: nextReaction(t.reaction ?? null) } : t
                      ));
                    }}
                    onToggleNote={() => setNoteEditingId((cur) => (cur === key ? null : key))}
                    onChangeNote={(text) => {
                      setPlaylistTracks(prev => prev.map((t, i) =>
                        i === index ? { ...t, note: text } : t
                      ));
                    }}
                    onAddMoment={(m) => {
                      setPlaylistTracks(prev => prev.map((t, i) =>
                        i === index ? { ...t, moments: [...(t.moments || []), m].sort((a, b) => a.seconds - b.seconds) } : t
                      ));
                    }}
                    onRemoveMoment={(idx) => {
                      setPlaylistTracks(prev => prev.map((t, i) =>
                        i === index ? { ...t, moments: (t.moments || []).filter((_, mi) => mi !== idx) } : t
                      ));
                    }}
                    onRemove={() => {
                      setNoteEditingId((cur) => (cur === key ? null : cur));
                      setPlaylistTracks((prev) => prev.filter((_, i) => i !== index));
                    }}
                    onFocusNote={scrollToInput}
                  />
                );
              })}
              {/* Add a track button */}
              <TouchableOpacity
                style={styles.addTrackButton}
                onPress={() => setShowPlaylistSearch(true)}
              >
                <Icon name="plus" size={15} color={gold} />
                <Text style={[styles.addTrackText, { color: gold }]}>add a track</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Playlist track search (when adding tracks) */}
          {mode === 'playlist' && showPlaylistSearch && (
            <View style={styles.section}>
              <TextInput
                style={styles.lineInput}
                value={trackQuery}
                onChangeText={(q) => {
                  setTrackQuery(q);
                  queueSearch(q, 'track');
                }}
                placeholder="search for a track to add..."
                placeholderTextColor="rgba(241,235,224,0.3)"
                autoCorrect={false}
                autoFocus
                onFocus={scrollToInput}
              />
              {searchingTrack && trackQuery.trim().length > 0 && <Text style={styles.hint}>searching...</Text>}
              {trackQuery.trim().length > 0 && trackResults.map((result, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchResult}
                  onPress={() => {
                    const normalized = normalizeResult(result);
                    if (playlistTracks.some((t) => t.id === normalized.id)) {
                      Alert.alert('Already added', 'This track is already in your playlist');
                      return;
                    }
                    setPlaylistTracks((prev) => [
                      ...prev,
                      { ...normalized, reaction: null, note: '', moments: [] },
                    ]);
                    setTrackResults([]);
                    setTrackQuery('');
                    setShowPlaylistSearch(false);
                  }}
                >
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {result.name || result.trackName || result.collectionName}
                  </Text>
                  <Text style={styles.searchResultArtist} numberOfLines={1}>
                    {result.artist || result.artistName}
                  </Text>
                </TouchableOpacity>
              ))}
              {trackResults.length === 0 && !searchingTrack && trackQuery.trim() && (
                <TouchableOpacity
                  style={[styles.addButton, { marginTop: 8 }]}
                  onPress={() => {
                    setShowPlaylistSearch(false);
                    setTrackQuery('');
                    setTrackResults([]);
                  }}
                >
                  <Text style={[styles.addButtonText, { color: 'rgba(241,235,224,0.65)' }]}>
                    close search
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Rating - centered without label */}
          {mode !== 'playlist' && (
            <View style={styles.ratingSection}>
              <View style={styles.ratingRow}>
                <StarsInput rating={rating} onChange={setRating} size={34} />
                <Text style={[styles.ratingNumber, { color: rating > 0 ? gold : 'rgba(241,235,224,0.3)' }]}>
                  {rating > 0 ? rating.toFixed(1) : '·'}
                </Text>
              </View>
              <Text style={styles.ratingHint}>tap to rate. that alone is a valid post</Text>
            </View>
          )}

          {/* Effort meter card */}
          {mode === 'playlist' ? (
            playlistTracks.length > 0 && (
              <View style={[styles.effortCard, { borderColor: 'rgba(241,235,224,0.09)' }]}>
                <View style={[styles.playlistBadge, { backgroundColor: `${gold}18` }]}>
                  <Text style={[styles.playlistBadgeText, { color: gold }]}>PLAYLIST</Text>
                </View>
                <Text style={styles.effortSummary}>
                  {playlistTracks.length} track{playlistTracks.length === 1 ? '' : 's'} · {playlistTracks.filter(t => t.note).length} annotated
                </Text>
              </View>
            )
          ) : rating > 0 ? (
            <View style={[styles.effortCard, { borderColor: 'rgba(241,235,224,0.09)' }]}>
              <View style={styles.effortBars}>
                {['floor', 'caption', 'full'].map((d, i) => {
                  const depthIndex = { floor: 0, caption: 1, full: 2 };
                  const isActive = depth && depthIndex[depth as keyof typeof depthIndex] >= i;
                  return (
                    <View
                      key={d}
                      style={[
                        styles.effortBarFull,
                        {
                          backgroundColor: isActive ? gold : 'rgba(241,235,224,0.12)',
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.effortRow}>
                <Text style={styles.effortSummary}>
                  posts as <Text style={[styles.effortType, { color: gold }]}>
                    {depth === 'floor' ? 'a quick rating' : depth === 'caption' ? 'a caption' : depth === 'full' ? 'a full note' : '·'}
                  </Text>
                </Text>
                <Text style={styles.effortLabel}>{depth || 'rate to begin'}</Text>
              </View>
              {mode === 'album' && albumTracks.length > 0 && (
                <View style={[styles.albumReviewBadge, { borderColor: 'rgba(241,235,224,0.08)' }]}>
                  <View style={[styles.albumBadge, { backgroundColor: `${gold}18` }]}>
                    <Text style={[styles.albumBadgeText, { color: gold }]}>ALBUM REVIEW</Text>
                  </View>
                  <Text style={styles.albumReviewStats}>
                    {Object.values(tracks).filter(t => !t.excluded).length} track{Object.values(tracks).filter(t => !t.excluded).length > 1 ? 's' : ''} · {Object.values(tracks).reduce((sum, t) => sum + t.moments.length, 0)} moment{Object.values(tracks).reduce((sum, t) => sum + t.moments.length, 0) === 1 ? '' : 's'}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Expandable chips */}
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                showTake && { borderColor: `${gold}88`, backgroundColor: `${gold}14` }
              ]}
              onPress={() => setShowTake(!showTake)}
            >
              <Text style={[styles.chipPlus, { color: showTake ? gold : 'rgba(241,235,224,0.75)' }]}>
                {showTake ? '−' : '+'}
              </Text>
              <Text style={[styles.chipText, { color: showTake ? gold : 'rgba(241,235,224,0.75)' }]}>
                {mode === 'playlist' ? 'describe it' : 'write a note'}
              </Text>
            </TouchableOpacity>

            {mode === 'album' && (
              <TouchableOpacity
                style={[
                  styles.chip,
                  showTracks && { borderColor: `${gold}88`, backgroundColor: `${gold}14` }
                ]}
                onPress={() => setShowTracks(!showTracks)}
              >
                <Text style={[styles.chipPlus, { color: showTracks ? gold : 'rgba(241,235,224,0.75)' }]}>
                  {showTracks ? '−' : '+'}
                </Text>
                <Text style={[styles.chipText, { color: showTracks ? gold : 'rgba(241,235,224,0.75)' }]}>
                  review the tracks{albumTracks.length > 0 ? ` · ${Object.values(tracks).filter(t => !t.excluded && (t.reaction || t.review || t.moments.length > 0)).length}` : ''}
                </Text>
              </TouchableOpacity>
            )}

            {mode === 'track' && (
              <TouchableOpacity
                style={[
                  styles.chip,
                  showMoments && { borderColor: `${gold}88`, backgroundColor: `${gold}14` }
                ]}
                onPress={() => setShowMoments(!showMoments)}
              >
                <Text style={[styles.chipPlus, { color: showMoments ? gold : 'rgba(241,235,224,0.75)' }]}>
                  {showMoments ? '−' : '+'}
                </Text>
                <Text style={[styles.chipText, { color: showMoments ? gold : 'rgba(241,235,224,0.75)' }]}>
                  mark moments{soloMoments.length > 0 ? ` · ${soloMoments.length}` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Write a note - expandable via chip */}
          {showTake && (
            <View style={styles.section}>
              <TextInput
                style={styles.textArea}
                value={take}
                onChangeText={setTake}
                placeholder={mode === 'playlist' ? "what's this playlist for?" : "write as much as you want, one line or the whole thing…"}
                placeholderTextColor="rgba(241,235,224,0.3)"
                multiline
                textAlignVertical="top"
                autoFocus
                onFocus={scrollToInput}
              />
              {mode !== 'playlist' && lines.length > 1 && (
                <View style={styles.captionPicker}>
                  <Text style={styles.captionLabel}>LEAD YOUR CARD WITH</Text>
                  {lines.map((line, i) => {
                    const active = i === captionIdx;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.captionRow,
                          active && { borderColor: `${gold}99`, backgroundColor: `${gold}14` }
                        ]}
                        onPress={() => setCaptionIndex(i)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.captionRadio,
                            { borderColor: active ? gold : 'rgba(241,235,224,0.3)' },
                            active && { backgroundColor: gold },
                          ]}
                        >
                          {active && <View style={styles.captionRadioDot} />}
                        </View>
                        <Text style={[styles.captionText, active && { color: tokens.colors.fg }]}>
                          {line}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.captionHint}>the rest becomes your full review. readers tap in for it</Text>
                </View>
              )}
              {mode !== 'playlist' && lines.length === 1 && (
                <Text style={styles.captionHint}>this line leads your card · write more for a full review</Text>
              )}
            </View>
          )}

          {/* Mark moments - track mode, expandable via chip */}
          {mode === 'track' && showMoments && (
            <View style={[styles.momentsCard, { borderColor: `${gold}33`, backgroundColor: `${gold}0a` }]}>
              <View style={styles.momentsHeader}>
                <Icon name="bookmark" size={16} color={gold} />
                <Text style={[styles.momentsLabel, { color: gold }]}>THE MOMENTS THAT GOT YOU</Text>
                <View style={styles.momentInputToggle}>
                  <TouchableOpacity
                    style={[
                      styles.momentInputToggleButton,
                      momentInputMode === 'manual' && { backgroundColor: `${gold}22`, borderColor: gold }
                    ]}
                    onPress={() => setMomentInputMode('manual')}
                  >
                    <Text style={[
                      styles.momentInputToggleText,
                      momentInputMode === 'manual' && { color: gold }
                    ]}>Manual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.momentInputToggleButton,
                      momentInputMode === 'lyrics' && { backgroundColor: `${gold}22`, borderColor: gold }
                    ]}
                    onPress={() => setMomentInputMode('lyrics')}
                  >
                    <Text style={[
                      styles.momentInputToggleText,
                      momentInputMode === 'lyrics' && { color: gold }
                    ]}>Lyrics</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {momentInputMode === 'manual' ? (
                <MomentsInput
                  moments={soloMoments}
                  onAdd={(m) =>
                    setSoloMoments((prev) =>
                      [...prev, m].sort((a, b) => a.seconds - b.seconds)
                    )
                  }
                  onRemove={(idx) => setSoloMoments(soloMoments.filter((_, i) => i !== idx))}
                  onFieldFocus={scrollToInput}
                  gold={gold}
                />
              ) : (
                selectedTrack && (
                  <View style={{ height: 500 }}>
                    <LyricsBrowser
                      trackName={selectedTrack.name}
                      artistName={selectedTrack.artist}
                      onBookmark={(m) =>
                        setSoloMoments((prev) =>
                          [...prev, m].sort((a, b) => a.seconds - b.seconds)
                        )
                      }
                      bookmarkedLines={new Set(soloMoments.map(m => m.lyric || '').filter(Boolean))}
                    />
                  </View>
                )
              )}
            </View>
          )}

          {/* Review tracks - album mode, expandable via chip */}
          {mode === 'album' && showTracks && albumTracks.length > 0 && (
            <View style={[styles.tracksCard, { borderColor: 'rgba(241,235,224,0.1)' }]}>
              <View style={styles.tracksHeader}>
                <Text style={styles.tracksLabel}>
                  {Object.values(tracks).every(t => !t.excluded) ? 'react to the ones that stood out' : 'tap a track to react'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectAllButton,
                    Object.values(tracks).every(t => !t.excluded)
                      ? { borderColor: 'rgba(241,235,224,0.2)' }
                      : { borderColor: `${gold}88`, backgroundColor: `${gold}14` }
                  ]}
                  onPress={() => {
                    const allSelected = Object.values(tracks).every(t => !t.excluded);
                    setTracks(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(key => {
                        updated[Number(key)] = { ...updated[Number(key)], excluded: allSelected };
                      });
                      return updated;
                    });
                  }}
                >
                  <Text style={[
                    styles.selectAllText,
                    { color: Object.values(tracks).every(t => !t.excluded) ? 'rgba(241,235,224,0.65)' : gold }
                  ]}>
                    {Object.values(tracks).every(t => !t.excluded) ? 'clear all' : 'select all'}
                  </Text>
                </TouchableOpacity>
              </View>
              {albumTracks.map((track, index) => {
                const trackNum = track.trackNumber || index + 1;
                const trackData = tracks[trackNum];
                const key = `album-${trackNum}`;
                const setTrack = (patch: Partial<TrackData>) =>
                  setTracks((prev) => {
                    const base: TrackData =
                      prev[trackNum] ?? { n: trackNum, name: track.name, reaction: null, review: '', moments: [] };
                    return { ...prev, [trackNum]: { ...base, ...patch } };
                  });
                return (
                  <EditableTrackRow
                    key={track.id || index}
                    number={trackNum}
                    name={track.name}
                    reaction={trackData?.reaction ?? null}
                    note={trackData?.review || ''}
                    moments={trackData?.moments || []}
                    noteOpen={noteEditingId === key}
                    gold={gold}
                    onCycleReaction={() => setTrack({ reaction: nextReaction(trackData?.reaction ?? null) })}
                    onToggleNote={() => setNoteEditingId((cur) => (cur === key ? null : key))}
                    onChangeNote={(text) => setTrack({ review: text })}
                    onAddMoment={(m) => setTrack({ moments: [...(trackData?.moments || []), m].sort((a, b) => a.seconds - b.seconds) })}
                    onRemoveMoment={(idx) => setTrack({ moments: (trackData?.moments || []).filter((_, i) => i !== idx) })}
                    onFocusNote={scrollToInput}
                  />
                );
              })}
            </View>
          )}

          {/* Post Button */}
          <TouchableOpacity
            style={[styles.postButton, (!canPost || isPosting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost || isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={tokens.colors.nearBlack} />
            ) : (
              <Text style={styles.postButtonText}>
                {mode === 'playlist'
                  ? !playlistName.trim()
                    ? 'Add a title'
                    : playlistTracks.length === 0
                    ? 'Add at least one track'
                    : `Post playlist with ${playlistTracks.length} track${playlistTracks.length !== 1 ? 's' : ''}`
                  : mode === 'track' && depth === 'full'
                  ? 'Post track note'
                  : mode === 'track' && depth === 'caption'
                  ? 'Post'
                  : mode === 'track' && depth === 'floor'
                  ? 'Post rating'
                  : rating > 0
                  ? 'Post'
                  : 'Add a rating to post'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Live preview — only once a song + rating are selected */}
          {previewCard && (
            <View style={styles.previewSection}>
              <Text style={styles.sectionLabel}>PREVIEW</Text>
              <ReviewCard review={previewCard} accent={gold} context="feed" />
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface SearchSectionProps {
  label: string;
  selectedLabel: string;
  placeholder: string;
  query: string;
  onChangeQuery: (q: string) => void;
  searching: boolean;
  results: any[];
  selected: any | null;
  onSelect: (result: any) => void;
  onClear: () => void;
}

function SearchSection({
  label,
  selectedLabel,
  placeholder,
  query,
  onChangeQuery,
  searching,
  results,
  selected,
  onSelect,
  onClear,
}: SearchSectionProps) {
  if (selected) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{selectedLabel}</Text>
        <View style={styles.selectedTrack}>
          <View style={styles.selectedTrackInfo}>
            <Text style={styles.selectedTrackName} numberOfLines={1}>
              {selected.name}
            </Text>
            <Text style={styles.selectedTrackArtist} numberOfLines={1}>
              {selected.artist}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.changeButton}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        style={styles.lineInput}
        value={query}
        onChangeText={onChangeQuery}
        placeholder={placeholder}
        placeholderTextColor="rgba(241,235,224,0.3)"
        autoCorrect={false}
      />
      {searching && query.trim().length > 0 && <Text style={styles.hint}>searching...</Text>}
      {query.trim().length > 0 && results.map((result, i) => (
        <TouchableOpacity
          key={i}
          style={styles.searchResult}
          onPress={() => onSelect(result)}
        >
          <Text style={styles.searchResultName} numberOfLines={1}>
            {result.name || result.trackName || result.collectionName}
          </Text>
          <Text style={styles.searchResultArtist} numberOfLines={1}>
            {result.artist || result.artistName}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface StarsInputProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}

function StarsInput({ rating, onChange, size = 34 }: StarsInputProps) {
  return (
    <View style={styles.starsContainer}>
      <Stars
        rating={rating}
        size={size}
        interactive
        onRatingChange={onChange}
        showNum={false}
      />
    </View>
  );
}

interface MomentsInputProps {
  moments: Moment[];
  onAdd: (moment: Moment) => void;
  onRemove: (index: number) => void;
  onFieldFocus?: () => void;
  gold: string;
}

function MomentsInput({ moments, onAdd, onRemove, onFieldFocus, gold }: MomentsInputProps) {
  const [input, setInput] = useState<MomentInput>({ mm: '', ss: '', note: '' });
  const ssRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  function handleAdd() {
    if (!input.note.trim()) return;
    const seconds = (parseInt(input.mm || '0', 10) * 60) + parseInt(input.ss || '0', 10);
    onAdd({ seconds, note: input.note.trim() });
    setInput({ mm: '', ss: '', note: '' });
  }

  return (
    <View style={styles.momentsContainer}>
      {moments.map((m, idx) => (
        <View key={idx} style={styles.momentRow}>
          <View style={[styles.momentTime, { backgroundColor: gold }]}>
            <Text style={styles.momentTimeText}>{formatTimestamp(m.seconds)}</Text>
          </View>
          <Text style={styles.momentNote}>{m.note}</Text>
          <TouchableOpacity onPress={() => onRemove(idx)} style={styles.momentRemove}>
            <Icon name="close" size={14} color="rgba(241,235,224,0.45)" />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.momentInput}>
        <TextInput
          style={styles.momentInputTime}
          value={input.mm}
          onChangeText={(v) => {
            const mm = v.replace(/\D/g, '').slice(0, 2);
            setInput((p) => ({ ...p, mm }));
            if (mm.length === 2) ssRef.current?.focus(); // auto-advance to ss
          }}
          onFocus={onFieldFocus}
          placeholder="m"
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => ssRef.current?.focus()}
        />
        <Text style={[styles.momentColon, { color: gold }]}>:</Text>
        <TextInput
          ref={ssRef}
          style={styles.momentInputTime}
          value={input.ss}
          onChangeText={(v) => {
            const ss = v.replace(/\D/g, '').slice(0, 2);
            setInput((p) => ({ ...p, ss }));
            if (ss.length === 2) noteRef.current?.focus(); // auto-advance to note
          }}
          onFocus={onFieldFocus}
          placeholder="ss"
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => noteRef.current?.focus()}
        />
        <TextInput
          ref={noteRef}
          style={styles.momentInputNote}
          value={input.note}
          onChangeText={(v) => setInput((p) => ({ ...p, note: v }))}
          onFocus={onFieldFocus}
          placeholder="what happens here?"
          placeholderTextColor="rgba(241,235,224,0.3)"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.momentAddButton, { backgroundColor: input.note.trim() ? gold : 'rgba(241,235,224,0.1)' }]}
        >
          <Text style={[styles.momentAddIcon, { color: input.note.trim() ? tokens.colors.nearBlack : 'rgba(241,235,224,0.4)' }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * A vertical track row with an optional reaction toggle and a bookmark icon
 * that opens an inline note editor. Shared by album + playlist composers so
 * reacting/noting a track is consistent everywhere.
 */
function EditableTrackRow({
  number,
  name,
  artist,
  reaction,
  note,
  moments = [],
  noteOpen,
  gold,
  showArtist,
  onCycleReaction,
  onToggleNote,
  onChangeNote,
  onAddMoment,
  onRemoveMoment,
  onRemove,
  onFocusNote,
}: {
  number: number;
  name: string;
  artist?: string;
  reaction: ReactionType;
  note?: string;
  moments?: Moment[];
  noteOpen: boolean;
  gold: string;
  showArtist?: boolean;
  onCycleReaction: () => void;
  onToggleNote: () => void;
  onChangeNote: (text: string) => void;
  onAddMoment?: (m: Moment) => void;
  onRemoveMoment?: (idx: number) => void;
  onRemove?: () => void;
  onFocusNote?: () => void;
}) {
  const momentCount = moments.length;

  return (
    <View style={styles.etrItem}>
      <View style={styles.etrRow}>
        {showArtist ? (
          <View style={[styles.etrDot, { backgroundColor: reaction ? gold : 'rgba(241,235,224,0.25)' }]} />
        ) : (
          <Text style={styles.etrNum}>{String(number).padStart(2, '0')}</Text>
        )}

        <TouchableOpacity style={styles.etrInfo} onPress={onCycleReaction} activeOpacity={0.7}>
          <Text style={styles.etrName} numberOfLines={1}>{name}</Text>
          {showArtist && !!artist && (
            <Text style={styles.etrArtist} numberOfLines={1}>{artist}</Text>
          )}
        </TouchableOpacity>

        {/* Optional reaction: tap to cycle none → flame → love → skip */}
        <TouchableOpacity style={styles.etrReact} onPress={onCycleReaction} activeOpacity={0.7}>
          {reaction ? (
            <ReactionIcon kind={reaction} size={18} />
          ) : (
            <View style={styles.etrReactEmpty} />
          )}
        </TouchableOpacity>

        {/* Bookmark → write a note and add moments for this track */}
        <TouchableOpacity
          style={[styles.etrBookmarkBtn, (noteOpen || !!note || momentCount > 0) && styles.etrBookmarkBtnActive]}
          onPress={onToggleNote}
          activeOpacity={0.7}
        >
          {momentCount > 0 && !noteOpen && (
            <Text style={[styles.etrMomentCount, { color: gold }]}>{momentCount}</Text>
          )}
          <Icon name="bookmark" size={16} color={noteOpen || !!note || momentCount > 0 ? gold : 'rgba(241,235,224,0.4)'} />
        </TouchableOpacity>

        {onRemove && (
          <TouchableOpacity style={styles.etrBtn} onPress={onRemove} activeOpacity={0.7}>
            <Icon name="close" size={15} color="rgba(241,235,224,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {noteOpen && (
        <View style={[styles.etrExpanded, { backgroundColor: `${gold}07` }]}>
          <TextInput
            style={styles.etrNoteInput}
            value={note}
            onChangeText={onChangeNote}
            placeholder={`a note on "${name}"…`}
            placeholderTextColor="rgba(241,235,224,0.3)"
            multiline
            textAlignVertical="top"
            onFocus={onFocusNote}
          />
          {onAddMoment && onRemoveMoment && (
            <MomentsInput
              moments={moments}
              onAdd={onAddMoment}
              onRemove={onRemoveMoment}
              onFieldFocus={onFocusNote}
              gold={gold}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg, // Musicathon deep maroon background
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingBottom: 8,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(241,235,224,0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 21,
    color: tokens.colors.fg,
    letterSpacing: -0.21,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    backgroundColor: 'rgba(241,235,224,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 150,
    gap: 20,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(241,235,224,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.09)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.65)',
  },
  modeTabTextActive: {
    color: tokens.colors.nearBlack,
  },
  section: {
    gap: 8,
  },
  previewSection: {
    gap: 10,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,235,224,0.08)',
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: tokens.colors.gold,
    textTransform: 'uppercase',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    // Touchable wrapper for star
  },
  textArea: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 13,
    padding: 12,
    paddingTop: 12,
    fontFamily: 'System',
    fontSize: 15,
    color: tokens.colors.fg,
    minHeight: 100,
    lineHeight: 21,
  },
  lineInput: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 13,
    padding: 12,
    fontFamily: 'System',
    fontSize: 15,
    color: tokens.colors.fg,
  },
  linkOk: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
  },
  linkWarn: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: '#e0762f',
    marginTop: 8,
  },
  captionPicker: {
    gap: 6,
    marginTop: 4,
  },
  captionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 0.6,
    color: 'rgba(241,235,224,0.45)',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    backgroundColor: 'rgba(241,235,224,0.04)',
  },
  captionRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  captionText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
    color: 'rgba(241,235,224,0.85)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(241,235,224,0.22)',
    backgroundColor: 'rgba(241,235,224,0.03)',
  },
  addButtonPlus: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
  },
  addButtonText: {
    fontFamily: 'System',
    fontSize: 13.5,
    fontWeight: '600',
  },
  momentsContainer: {
    gap: 8,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(241,235,224,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
  },
  momentTime: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  momentTimeText: {
    fontFamily: 'Menlo',
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  momentNote: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.85)',
  },
  momentRemove: {
    padding: 2,
  },
  momentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  momentInputTime: {
    width: 42,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 9,
    textAlign: 'center',
    fontFamily: 'Menlo',
    fontSize: 15,
    color: tokens.colors.fg,
  },
  momentColon: {
    fontFamily: 'Menlo',
    fontSize: 16,
  },
  momentInputNote: {
    flex: 1,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 9,
    paddingHorizontal: 11,
    fontFamily: 'System',
    fontSize: 13,
    color: tokens.colors.fg,
  },
  momentAddButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentAddIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: tokens.colors.gold,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.4)',
    marginTop: 8,
  },
  searchResult: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderRadius: 8,
    marginTop: 8,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  searchResultArtist: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  selectedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  selectedTrackInfo: {
    flex: 1,
  },
  selectedTrackName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  selectedTrackArtist: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.7)',
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.gold,
  },
  trackStripLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  trackStripLoadingText: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.5)',
  },
  trackStrip: {
    gap: 8,
    paddingVertical: 8,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    backgroundColor: 'rgba(241,235,224,0.04)',
    minWidth: 140,
    maxWidth: 200,
  },
  trackChipNumber: {
    fontFamily: 'Menlo',
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.5)',
    minWidth: 20,
  },
  trackChipInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackChipName: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.fg,
  },
  trackChipReaction: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackStripEmpty: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.4)',
    paddingVertical: 16,
    textAlign: 'center',
  },
  playlistHint: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.2,
    lineHeight: 14,
    marginTop: 6,
  },
  playlistTrackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
    marginTop: 8,
  },
  playlistTrackInfo: {
    flex: 1,
    gap: 4,
  },
  playlistTrackNote: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.7)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  playlistTrackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  playlistActionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
  },
  playlistActionNote: {
    fontFamily: 'System',
    fontSize: 11.5,
    fontWeight: '600',
  },
  playlistNoteInput: {
    marginTop: 6,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 10,
    padding: 9,
    fontFamily: 'System',
    fontSize: 13.5,
    color: tokens.colors.fg,
    minHeight: 54,
  },
  etrItem: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
  },
  etrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  etrNum: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
    width: 22,
  },
  etrInfo: {
    flex: 1,
    minWidth: 0,
  },
  etrName: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  etrArtist: {
    fontFamily: 'System',
    fontSize: 12,
    color: 'rgba(241,235,224,0.6)',
    marginTop: 1,
  },
  etrNote: {
    fontFamily: 'System',
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(241,235,224,0.7)',
    marginTop: 4,
  },
  etrReact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etrReactEmpty: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(241,235,224,0.28)',
  },
  etrBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
  },
  // Rating section - centered without label
  ratingSection: {
    marginTop: 22,
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ratingNumber: {
    fontFamily: 'Menlo',
    fontSize: 22,
    minWidth: 36,
    textAlign: 'left',
  },
  ratingHint: {
    marginTop: 8,
    fontFamily: 'System',
    fontSize: 12,
    color: 'rgba(241,235,224,0.45)',
  },
  // Effort meter card
  effortCard: {
    marginTop: 18,
    padding: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
  },
  effortBars: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  effortBarFull: {
    flex: 1,
    height: 4,
    borderRadius: 3,
  },
  effortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  effortSummary: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: 'rgba(241,235,224,0.7)',
  },
  effortType: {
    fontWeight: '600',
  },
  effortLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  playlistBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 9,
  },
  playlistBadgeText: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  albumReviewBadge: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  albumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  albumBadgeText: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  albumReviewStats: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.55)',
  },
  // Chip-based expandable sections
  chipRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.16)',
    backgroundColor: 'transparent',
  },
  chipPlus: {
    fontSize: 15,
    lineHeight: 15,
  },
  chipText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '500',
  },
  // Moments card
  momentsCard: {
    marginTop: 13,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  momentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 11,
  },
  momentsLabel: {
    flex: 1,
    fontFamily: 'Menlo',
    fontSize: 11,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
  momentInputToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  momentInputToggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.2)',
    backgroundColor: 'transparent',
  },
  momentInputToggleText: {
    fontFamily: 'Menlo',
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.6)',
    letterSpacing: 0.4,
  },
  // Tracks card (album mode)
  tracksCard: {
    marginTop: 13,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tracksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  tracksLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(241,235,224,0.5)',
    textTransform: 'uppercase',
  },
  selectAllButton: {
    flexShrink: 0,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectAllText: {
    fontFamily: 'System',
    fontSize: 11.5,
    fontWeight: '600',
  },
  // Caption picker
  captionRadioDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colors.bg,
  },
  captionHint: {
    marginTop: 8,
    fontFamily: 'Menlo',
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.3,
  },
  // Proposed content card
  proposedCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
  },
  proposedArt: {
    width: 58,
    height: 58,
    borderRadius: 9,
    overflow: 'hidden',
    flexShrink: 0,
  },
  proposedInfo: {
    flex: 1,
    minWidth: 0,
  },
  proposedLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  proposedTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 17,
    color: tokens.colors.fg,
    lineHeight: 18.7,
  },
  proposedMeta: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: tokens.colors.muted,
  },
  proposedChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proposedChangeText: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.55)',
  },
  playlistTitleInput: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  // Spotify/Apple link paste
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
    marginTop: 11,
  },
  linkInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Menlo',
    fontSize: 12,
    color: tokens.colors.fg,
  },
  linkHint: {
    marginTop: 6,
    fontFamily: 'Menlo',
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.2,
    lineHeight: 13,
  },
  // Playlist tracks
  playlistTracksLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(241,235,224,0.5)',
    textTransform: 'uppercase',
  },
  addTrackButton: {
    width: '100%',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addTrackText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
  },
  // Editable track row
  etrDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
    marginLeft: 13,
  },
  etrBookmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 11,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(241,235,224,0.06)',
  },
  etrBookmarkBtnActive: {
    // Active state handled by color changes
  },
  etrMomentCount: {
    fontFamily: 'Menlo',
    fontSize: 10,
  },
  etrExpanded: {
    padding: 2,
    paddingHorizontal: 13,
    paddingBottom: 13,
    gap: 8,
  },
  etrNoteInput: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 11,
    paddingHorizontal: 13,
    fontFamily: 'System',
    fontSize: 13,
    color: tokens.colors.fg,
    minHeight: 54,
  },
});
