import { tokens } from '../lib/tokens';
/**
 * LinerNotes Experience Screen - Musicathon Edition
 * Immersive read-along with:
 * - Album-color background gradients
 * - Synced lyrics from Musixmatch (fetched live, never cached per contest rules)
 * - Auto-scrolling lyrics with active line highlighting
 * - Live moment callouts that pulse when hit
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Linking, Alert, Image, Animated, PanResponder, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/atoms/Icon';
import { Stars } from '../components/atoms/Stars';
import { ReactionIcon } from '../components/atoms/Reactions';
import { formatTimestamp } from '../lib/time-utils';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api-client';
import type { FeedReview } from '../lib/feed-types';
import { lastfm } from '../services/lastfm';
import { ShareSheet } from '../components/ShareSheet';
import { ReviewShareCard, LyricShareCard } from '../components/share';
import { shareToInstagramStory, shareToTikTok, saveCardImage, shareToTwitter } from '../lib/share-utils';
import * as Clipboard from 'expo-clipboard';
import { EQVisualizer } from '../components/atoms/EQVisualizer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExperienceScreenProps {
  review: FeedReview;
  onClose: () => void;
  onDeleted?: () => void;
}

interface Palette {
  deep: string;
  mid: string;
  lo: string;
  accent: string;
  glow: string;
}

interface LyricLine {
  text: string;
  time: { total: number }; // milliseconds
}

interface SyncedLyrics {
  lines: LyricLine[];
  translation?: LyricLine[];
  language?: string;
}

export function ExperienceScreen({ review, onClose, onDeleted }: ExperienceScreenProps) {
  const { user } = useAuth();
  const { album, rating } = review;
  const p: Palette = album.palette;
  const gold = tokens.colors.gold;
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [spotifyOpening, setSpotifyOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<{ name: string; artist: string } | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0); // seconds
  const [lyrics, setLyrics] = useState<SyncedLyrics | null>(null);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [reviewerNoteOpen, setReviewerNoteOpen] = useState(true);
  const [armedMoment, setArmedMoment] = useState<any | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const lyricListRef = useRef<FlatList>(null);
  const shareCardRef = useRef<View>(null);

  const isAlbum = !!(album.tracks && album.tracks.length > 0);
  const isAlbumReview = album.kind === 'album';
  const npTrack = album.tracks?.find((t) => t.moments && t.moments.length > 0);

  // Fetch lyrics when the track is determined
  useEffect(() => {
    let isMounted = true;

    const fetchLyrics = async () => {
      try {
        // For now, fetch based on track name and artist (would use ISRC in production)
        const trackName = album.kind === 'album' && npTrack ? npTrack.name : album.title;
        const artistName = album.artist;

        if (!trackName || !artistName) return;

        const response = await fetch(
          `${api.baseUrl}/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`
        );

        if (response.status === 401 || response.status === 403) {
          setLyricsError('Musixmatch trial key expired. See demo video for full experience!');
          return;
        }

        if (!response.ok) {
          console.log('[Experience] No synced lyrics available');
          return;
        }

        const data = await response.json();
        if (isMounted && data.lyrics) {
          setLyrics({
            lines: data.lyrics,
            translation: data.translation || undefined,
            language: data.track?.language || data.subtitle_language || undefined,
          });
        }
      } catch (error) {
        console.error('[Experience] Failed to fetch lyrics:', error);
      }
    };

    fetchLyrics();

    return () => {
      isMounted = false;
    };
  }, [album.kind, album.title, album.artist, npTrack]);

  // Check Last.fm for currently playing track and track playback position
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkNowPlaying = async () => {
      try {
        const username = await lastfm.getUsername();
        if (!username) return;

        const recentTracks = await lastfm.getRecentTracks(username, 1);
        if (!recentTracks || recentTracks.length === 0) return;

        const track = recentTracks[0];
        const isPlaying = track['@attr']?.nowplaying === 'true';

        if (!isPlaying) {
          setNowPlayingTrack(null);
          return;
        }

        const trackArtist = (track.artist as any)?.name || track.artist;
        const trackAlbum = typeof track.album === 'string' ? track.album : track.album?.['#text'];

        const matchesArtist = trackArtist?.toLowerCase().includes(album.artist?.toLowerCase() || '') ||
                             album.artist?.toLowerCase().includes(trackArtist?.toLowerCase() || '');
        const matchesAlbum = trackAlbum?.toLowerCase() === album.title?.toLowerCase();

        if (matchesArtist && (matchesAlbum || !isAlbum)) {
          setNowPlayingTrack({
            name: track.name,
            artist: trackArtist,
          });
          // Estimate playback position (Last.fm doesn't provide this, so we estimate)
          // In production, use Spotify Web Playback SDK for accurate position
          setPlaybackPosition((prev) => prev + 3);
        } else {
          setNowPlayingTrack(null);
        }
      } catch (error) {
        console.error('[Experience] Failed to check Last.fm now playing:', error);
      }
    };

    checkNowPlaying();
    interval = setInterval(checkNowPlaying, 3000);

    return () => clearInterval(interval);
  }, [album.artist, album.title, isAlbum]);

  // Find active lyric line based on playback position (always use original lines for timing)
  const activeLineIndex = lyrics?.lines.findIndex((line, i) => {
    const currentTime = playbackPosition * 1000;
    const nextLine = lyrics.lines[i + 1];
    return line.time.total <= currentTime && (!nextLine || nextLine.time.total > currentTime);
  }) ?? -1;

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineIndex >= 0 && lyricListRef.current) {
      lyricListRef.current.scrollToIndex({
        index: activeLineIndex,
        animated: true,
        viewPosition: 0.4, // Center at 40% from top
      });
    }
  }, [activeLineIndex]);

  // Find active moment (pulses for 5s after playhead hits it)
  const activeMoment = review.notes?.find((m) =>
    playbackPosition >= m.sec && playbackPosition < m.sec + 5
  ) || null;

  // Arm the moment for sharing when it becomes active
  useEffect(() => {
    if (activeMoment) {
      setArmedMoment(activeMoment);
    }
  }, [activeMoment]);

  // Update isPlaying based on Last.fm nowPlaying status
  useEffect(() => {
    setIsPlaying(!!nowPlayingTrack);
  }, [nowPlayingTrack]);

  const isOwn = !!user?.handle && review.user?.handle === user.handle;

  // Swipe down to dismiss
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
          Animated.spring(translateY, { toValue: 0, bounciness: 2, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const confirmDelete = () => {
    Alert.alert(
      isAlbumReview ? 'Delete album review?' : 'Delete note?',
      isAlbumReview
        ? 'This permanently removes your album review. This can't be undone.'
        : 'This permanently removes your note. This can't be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              if (isAlbumReview) {
                await api.deleteAlbumReview(review.id);
              } else {
                await api.deleteReview(review.id);
              }
              (onDeleted ?? onClose)();
            } catch (e: any) {
              setDeleting(false);
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const openSpotify = async () => {
    setSpotifyOpening(true);

    try {
      const query = `${album.title} ${album.artist}`.trim();
      if (!query) {
        Alert.alert('Error', 'Unable to open in Spotify - missing track info');
        return;
      }

      const encoded = encodeURIComponent(query);
      const appUri = `spotify:search:${encoded}`;
      const webUrl = `https://open.spotify.com/search/${encoded}`;

      const canOpenApp = await Linking.canOpenURL(appUri).catch(() => false);
      await Linking.openURL(canOpenApp ? appUri : webUrl);
    } catch (error) {
      console.error('Failed to open Spotify:', error);
      try {
        await Linking.openURL(
          `https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist}`)}`
        );
      } catch {
        Alert.alert('Error', 'Could not open Spotify');
      }
    } finally {
      setTimeout(() => setSpotifyOpening(false), 1200);
    }
  };

  const tapNote = (key: string) => {
    setActiveNote(key);
    setTimeout(() => setActiveNote(null), 2600);
  };

  const handleExport = async (format: 'instagram' | 'tiktok' | 'camera' | 'twitter', cardFormat?: 'story' | 'square') => {
    if (!shareCardRef.current) {
      Alert.alert('Error', 'Unable to capture card. Please try again.');
      return;
    }

    try {
      // Generate review URL (would be actual deep link in production)
      const reviewUrl = `https://linernotes.app/review/${review.id}`;

      // Copy link to clipboard for all formats
      await Clipboard.setStringAsync(reviewUrl);

      // Handle different export formats
      switch (format) {
        case 'instagram':
          await shareToInstagramStory(shareCardRef.current);
          break;
        case 'tiktok':
          await shareToTikTok(shareCardRef.current);
          break;
        case 'camera':
          await saveCardImage(shareCardRef.current);
          break;
        case 'twitter':
          await shareToTwitter(shareCardRef.current, reviewUrl);
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Error', 'Failed to export card. Please try again.');
    }
  };

  const renderLyricLine = ({ item, index }: { item: LyricLine; index: number }) => {
    const isActive = index === activeLineIndex;
    const passed = activeLineIndex >= 0 && index < activeLineIndex;
    const distance = Math.abs(index - activeLineIndex);
    const hasTranslation = lyrics?.translation && lyrics.translation[index];

    // Check if this line has an associated moment (annotation)
    const lineSec = item.time.total / 1000;
    const hasAnnotation = review.notes?.some((m) => {
      // Find lyric line closest to moment timestamp
      let closestIndex = 0;
      let closestDiff = Infinity;
      lyrics?.lines?.forEach((l, i) => {
        const diff = Math.abs((l.time.total / 1000) - m.sec);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      });
      return closestIndex === index;
    });

    return (
      <TouchableOpacity
        onPress={() => {
          setPlaybackPosition(item.time.total / 1000);
          // If this line has annotation, arm it
          if (hasAnnotation) {
            const moment = review.notes?.find((m) => {
              let closestIndex = 0;
              let closestDiff = Infinity;
              lyrics?.lines?.forEach((l, i) => {
                const diff = Math.abs((l.time.total / 1000) - m.sec);
                if (diff < closestDiff) {
                  closestDiff = diff;
                  closestIndex = i;
                }
              });
              return closestIndex === index;
            });
            if (moment) setArmedMoment(moment);
          }
        }}
        style={[
          styles.lyricLine,
          {
            opacity: isActive ? 1 : Math.max(0.3, 1 - distance * 0.12),
          },
        ]}
      >
        {isActive && (
          <View style={[styles.lyricIndicator, { backgroundColor: gold }]} />
        )}
        <View style={styles.lyricTextContainer}>
          <Text
            style={[
              styles.lyricText,
              {
                fontSize: isActive ? 24 : 18,
                fontWeight: isActive ? '600' : '500',
                color: isActive ? '#f1ebe0' : passed ? 'rgba(241,235,224,0.35)' : 'rgba(241,235,224,0.55)',
              },
            ]}
          >
            {item.text}
            {hasAnnotation && !isActive && (
              <View style={[styles.lyricAnnotationBadge, { backgroundColor: `${gold}1c`, borderColor: `${gold}44` }]}>
                <Icon name="bookmark" size={8} color={gold} />
                <Text style={[styles.lyricAnnotationText, { color: gold }]}>lyric</Text>
              </View>
            )}
          </Text>
          {hasTranslation && (
            <View style={styles.translationLine}>
              <Text style={styles.translationArrow}>↳</Text>
              <Text
                style={[
                  styles.translationText,
                  {
                    fontSize: isActive ? 16 : 13,
                    color: isActive ? 'rgba(241,235,224,0.75)' : passed ? 'rgba(241,235,224,0.25)' : 'rgba(241,235,224,0.4)',
                  },
                ]}
              >
                {lyrics.translation[index].text}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      {/* Immersive blurred flood */}
      <View style={styles.blurContainer}>
        <LinearGradient
          colors={[p.mid, p.deep, p.lo]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.3, y: 0.22 }}
          end={{ x: 0.7, y: 0.78 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${p.glow}cc`, 'transparent']}
          start={{ x: 0.8, y: 0.8 }}
          end={{ x: 0.2, y: 0.2 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        />
        <LinearGradient
          colors={[`${p.accent}55`, 'transparent']}
          start={{ x: 0.12, y: 0.9 }}
          end={{ x: 0.5, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
        />
      </View>

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(8,7,6,0.35)', 'rgba(8,7,6,0.15)', 'rgba(8,7,6,0.78)']}
        locations={[0, 0.32, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Sharp cover */}
          <TouchableOpacity onPress={openSpotify} style={styles.cover}>
            {album.artworkUrl ? (
              <Image source={{ uri: album.artworkUrl }} style={styles.coverPlaceholder} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverLabel}>{album.title?.toLowerCase()}</Text>
              </View>
            )}
            {/* EQ visualizer badge */}
            <View style={styles.eqBadge}>
              <EQVisualizer color={gold} isPlaying={isPlaying} size={15} />
            </View>
          </TouchableOpacity>

          {/* Title + artist */}
          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.artist}>
            {album.artist}{album.year ? ` · ${album.year}` : ''}
          </Text>

          {/* Rating */}
          <View style={styles.rating}>
            <Stars rating={rating} size={16} color={gold} />
          </View>

          {/* Open in Spotify */}
          <TouchableOpacity onPress={openSpotify} style={styles.spotifyButton}>
            <View style={styles.spotifyIcon}>
              <Icon name="play" size={8} color="#fff" />
            </View>
            <Text style={styles.spotifyText}>Open in Spotify</Text>
          </TouchableOpacity>

          {/* Now playing companion */}
          {nowPlayingTrack && (
            <View style={[styles.nowPlaying, { backgroundColor: `${gold}12`, borderColor: `${gold}3a` }]}>
              <View style={styles.equalizer}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.eqBar, { backgroundColor: gold }]} />
                ))}
              </View>
              <View style={styles.nowPlayingInfo}>
                <Text style={[styles.nowPlayingLabel, { color: gold }]}>listening now</Text>
                <Text style={styles.nowPlayingTrack} numberOfLines={1}>
                  {nowPlayingTrack.name}
                </Text>
              </View>
              <Text style={styles.nowPlayingSource}>via{'\n'}last.fm</Text>
            </View>
          )}

          {/* Reviewer note card */}
          {review.take && (
            <View style={[styles.reviewerNote, { backgroundColor: `${gold}10`, borderColor: `${gold}33` }]}>
              <View style={styles.reviewerNoteHeader}>
                <View style={[styles.reviewerAvatar, { backgroundColor: `${review.user?.tint || gold}26`, borderColor: `${review.user?.tint || gold}66` }]}>
                  <Text style={[styles.reviewerAvatarText, { color: review.user?.tint || gold }]}>
                    {review.user?.displayName?.[0] || review.user?.handle?.[0] || '?'}
                  </Text>
                </View>
                <View style={styles.reviewerInfo}>
                  <Text style={[styles.reviewerLabel, { color: gold }]}>
                    what {review.user?.displayName?.split(' ')[0] || review.user?.handle || 'they'} wrote
                  </Text>
                  <Text style={styles.reviewerHandle}>@{review.user?.handle || 'user'}</Text>
                </View>
                <TouchableOpacity onPress={() => setReviewerNoteOpen(!reviewerNoteOpen)} style={styles.reviewerToggle}>
                  <Text style={styles.reviewerToggleText}>{reviewerNoteOpen ? 'hide' : 'show'}</Text>
                </TouchableOpacity>
              </View>
              {reviewerNoteOpen && (
                <Text style={styles.reviewerNoteText}>{review.take}</Text>
              )}
            </View>
          )}

          {/* Active moment live callout */}
          <View style={{ width: '100%', height: 46, marginTop: 10, position: 'relative' }}>
            {activeMoment && (
              <View style={[styles.activeMoment, { backgroundColor: gold, boxShadow: `0 12px 26px -12px ${gold}` }]}>
                <Text style={styles.activeMomentTime}>{formatTimestamp(activeMoment.sec)}</Text>
                <View style={styles.activeMomentDivider} />
                <Text style={styles.activeMomentText} numberOfLines={1}>
                  {activeMoment.label} — {activeMoment.note}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setArmedMoment(activeMoment);
                    setShareSheetVisible(true);
                  }}
                  style={styles.activeMomentShareButton}
                >
                  <Icon name="share" size={12} color="#1a0d0e" />
                  <Text style={styles.activeMomentShareText}>Share</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* The caption */}
          {review.take && (
            <Text style={styles.quote}>"{review.take.split('\n')[0]}"</Text>
          )}
          {review.take && review.take.split('\n').slice(1).join('\n').trim() ? (
            <Text style={styles.body}>
              {review.take.split('\n').slice(1).join('\n').trim()}
            </Text>
          ) : null}
          {review.body && (
            <Text style={styles.body}>{review.body}</Text>
          )}

          {/* Synced lyrics section */}
          {lyrics && lyrics.lines.length > 0 && (
            <View style={styles.section}>
              <View style={styles.lyricsHeader}>
                <View style={styles.lyricsHeaderLeft}>
                  <Text style={[styles.sectionLabel, { color: gold }]}>lyrics</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(244,239,230,0.12)', marginHorizontal: 8 }} />
                  {review.notes && review.notes.length > 0 && (
                    <TouchableOpacity
                      onPress={() => armedMoment && setShareSheetVisible(true)}
                      disabled={!armedMoment}
                      style={[
                        styles.shareLyricButton,
                        {
                          backgroundColor: armedMoment ? `${gold}1a` : 'rgba(244,239,230,0.05)',
                          borderColor: armedMoment ? `${gold}55` : 'rgba(244,239,230,0.14)',
                        },
                      ]}
                    >
                      <Icon name="share" size={11} color={armedMoment ? gold : 'rgba(241,235,224,0.38)'} />
                      <Text style={[styles.shareLyricButtonText, { color: armedMoment ? gold : 'rgba(241,235,224,0.38)' }]}>
                        Share lyric
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.musixmatchAttr}>
                    synced · Musixmatch
                  </Text>
                </View>
              </View>
              <View style={styles.lyricsContainer}>
                <FlatList
                  ref={lyricListRef}
                  data={lyrics.lines}
                  renderItem={renderLyricLine}
                  keyExtractor={(_, i) => `lyric-${i}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.lyricsList}
                  onScrollToIndexFailed={() => {}}
                />
              </View>
            </View>
          )}

          {lyricsError && (
            <View style={styles.lyricsError}>
              <Text style={styles.lyricsErrorText}>{lyricsError}</Text>
            </View>
          )}

          {/* Single-track moments */}
          {!isAlbum && !lyrics && review.notes && review.notes.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: gold }]}>
                the moment{review.notes.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.momentInstructions}>
                tap to read ahead — it follows the song, it won't skip it.
              </Text>
              <View style={styles.moments}>
                {review.notes.map((m, idx) => {
                  const key = `solo-${idx}`;
                  const isActive = activeNote === key;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => tapNote(key)}
                      style={[
                        styles.momentButton,
                        {
                          borderColor: isActive ? `${gold}99` : 'rgba(241,235,224,0.1)',
                          backgroundColor: isActive ? `${gold}14` : 'rgba(241,235,224,0.04)',
                        },
                      ]}
                    >
                      <View style={[styles.momentTimeBox, { backgroundColor: gold }]}>
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.sec)}</Text>
                      </View>
                      <Text style={styles.momentNoteText} numberOfLines={2}>
                        {m.note}
                      </Text>
                      {isActive && (
                        <Text style={[styles.readAhead, { color: gold }]}>read{'\n'}ahead</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Album: expandable track strip */}
          {isAlbum && album.tracks && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: gold }]}>tracks</Text>
              <AlbumTrackStrip tracks={album.tracks} gold={gold} onTapMoment={tapNote} activeNote={activeNote} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete button */}
      {isOwn && (
        <View style={styles.deleteBar}>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting…' : isAlbumReview ? 'Delete album review' : 'Delete note'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fixed top bar */}
      <View style={styles.topBar} {...panResponder.panHandlers}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="chevdown" size={20} color="#f1ebe0" />
        </TouchableOpacity>
        <Text style={styles.experienceLabel}>the experience · Musicathon</Text>
        <TouchableOpacity onPress={() => setShareSheetVisible(true)} style={styles.shareButton}>
          <Icon name="share" size={18} color="#f1ebe0" />
        </TouchableOpacity>
      </View>

      {/* Share sheet */}
      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        onExport={handleExport}
        accent={gold}
        type="review"
        hasFull={!!review.body}
      >
        {({ format, linkSlot }) => (
          <View ref={shareCardRef} collapsable={false}>
            <ReviewShareCard
              review={review}
              format={format}
              linkSlot={linkSlot}
            />
          </View>
        )}
      </ShareSheet>
    </Animated.View>
  );
}

function AlbumTrackStrip({
  tracks,
  gold,
  onTapMoment,
  activeNote,
}: {
  tracks: any[];
  gold: string;
  onTapMoment: (key: string) => void;
  activeNote: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (n: number) => setExpanded((e) => ({ ...e, [n]: !e[n] }));

  return (
    <View style={styles.trackStrip}>
      {tracks.map((t) => {
        const hasMoments = t.moments && t.moments.length > 0;
        const trackNote: string = (t.review || '').trim();
        const hasNote = !!trackNote;
        const hasContent = hasMoments || hasNote;
        const isExpanded = expanded[t.n];

        return (
          <View key={t.n}>
            <TouchableOpacity
              onPress={() => toggle(t.n)}
              style={styles.trackStripRow}
              disabled={!hasContent}
            >
              <Text style={styles.trackStripNum}>{String(t.n).padStart(2, '0')}</Text>
              <Text style={styles.trackStripName} numberOfLines={1}>
                {t.name}
              </Text>
              {t.reaction && <ReactionIcon kind={t.reaction} size={15} />}
              {hasNote && <Icon name="bookmark" size={13} color={gold} filled />}
              {hasMoments && (
                <Text style={[styles.trackStripMomentCount, { color: gold }]}>
                  {t.moments.length}
                </Text>
              )}
            </TouchableOpacity>

            {isExpanded && hasContent && (
              <View style={styles.trackMoments}>
                {hasNote && (
                  <View style={[styles.trackMomentRow, { borderColor: 'rgba(241,235,224,0.08)', backgroundColor: 'rgba(241,235,224,0.02)' }]}>
                    <Text style={styles.trackMomentText}>{trackNote}</Text>
                  </View>
                )}
                {hasMoments && t.moments.map((m: any, idx: number) => {
                  const key = `track-${t.n}-${idx}`;
                  const isActive = activeNote === key;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => onTapMoment(key)}
                      style={[
                        styles.trackMomentRow,
                        {
                          borderColor: isActive ? `${gold}99` : 'rgba(241,235,224,0.08)',
                          backgroundColor: isActive ? `${gold}0f` : 'rgba(241,235,224,0.02)',
                        },
                      ]}
                    >
                      <View style={[styles.momentTimeBox, { backgroundColor: gold }]}>
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.sec)}</Text>
                      </View>
                      <Text style={styles.trackMomentText} numberOfLines={2}>
                        {m.note}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  blurContainer: {
    position: 'absolute',
    top: -80,
    left: -80,
    right: -80,
    bottom: -80,
    transform: [{ scale: 1.1 }],
  },
  scrollContent: {
    paddingTop: 96,
    paddingBottom: 110,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 8,
  },
  deleteBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 34,
  },
  deleteButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(224,118,47,0.5)',
    backgroundColor: 'rgba(224,118,47,0.10)',
  },
  deleteButtonText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#e0762f',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  experienceLabel: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: 'rgba(241,235,224,0.65)',
  },
  contentContainer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    alignItems: 'center',
  },
  cover: {
    width: 168,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.85,
    shadowRadius: 40,
    elevation: 20,
    position: 'relative',
  },
  eqBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(8,6,7,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    width: 168,
    height: 168,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    padding: 12,
  },
  title: {
    marginTop: 18,
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 26,
    lineHeight: 28.6,
    color: '#f1ebe0',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  artist: {
    marginTop: 3,
    fontFamily: 'System',
    fontSize: 18,
    color: 'rgba(241,235,224,0.72)',
  },
  rating: {
    marginTop: 11,
  },
  spotifyButton: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.18)',
    backgroundColor: 'rgba(241,235,224,0.06)',
  },
  spotifyIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: '#f1ebe0',
  },
  nowPlaying: {
    width: '100%',
    marginTop: 22,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  eqBar: {
    width: 3,
    borderRadius: 2,
    height: '60%',
  },
  nowPlayingInfo: {
    flex: 1,
    gap: 2,
  },
  nowPlayingLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nowPlayingTrack: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#f1ebe0',
  },
  nowPlayingSource: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.5)',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  reviewerNote: {
    width: '100%',
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  reviewerNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  reviewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 13,
  },
  reviewerInfo: {
    flex: 1,
    minWidth: 0,
  },
  reviewerLabel: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reviewerHandle: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: 'rgba(241,235,224,0.7)',
  },
  reviewerToggle: {
    padding: 4,
  },
  reviewerToggleText: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.55)',
  },
  reviewerNoteText: {
    marginTop: 9,
    fontFamily: 'System',
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 23,
    color: '#f1ebe0',
  },
  activeMoment: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 13,
    paddingRight: 8,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  activeMomentTime: {
    fontFamily: 'Menlo',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1a0d0e',
  },
  activeMomentDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(26,13,14,0.3)',
  },
  activeMomentText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: '#1a0d0e',
  },
  activeMomentShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26,13,14,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeMomentShareText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#1a0d0e',
  },
  quote: {
    marginTop: 24,
    fontFamily: 'System',
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 25.2,
    color: '#f1ebe0',
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    marginTop: 18,
    fontFamily: 'System',
    fontSize: 16,
    lineHeight: 25.92,
    color: 'rgba(241,235,224,0.78)',
    maxWidth: 340,
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  lyricsHeader: {
    marginBottom: 4,
  },
  lyricsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLyricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shareLyricButtonText: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '600',
  },
  musixmatchAttr: {
    fontFamily: 'Menlo',
    fontSize: 9,
    color: 'rgba(241,235,224,0.45)',
    letterSpacing: 0.4,
  },
  lyricsContainer: {
    height: 360,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lyricsList: {
    paddingVertical: 20,
  },
  lyricLine: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lyricIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  lyricTextContainer: {
    flex: 1,
    gap: 6,
  },
  lyricText: {
    fontFamily: 'System',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  lyricAnnotationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 9,
  },
  lyricAnnotationText: {
    fontFamily: 'Menlo',
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  translationLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 4,
  },
  translationArrow: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(241,235,224,0.3)',
    marginTop: -2,
  },
  translationText: {
    flex: 1,
    fontFamily: 'System',
    fontStyle: 'italic',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  lyricsError: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(224,118,47,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224,118,47,0.3)',
  },
  lyricsErrorText: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.8)',
    textAlign: 'center',
  },
  momentInstructions: {
    fontFamily: 'System',
    fontSize: 11.5,
    color: 'rgba(241,235,224,0.5)',
    marginTop: 9,
    marginBottom: 12,
    lineHeight: 16,
  },
  moments: {
    gap: 8,
  },
  momentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  momentTimeBox: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  momentTimeText: {
    fontFamily: 'Menlo',
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
    letterSpacing: -0.25,
  },
  momentNoteText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(241,235,224,0.86)',
  },
  readAhead: {
    fontFamily: 'Menlo',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  trackStrip: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.1)',
    backgroundColor: 'rgba(241,235,224,0.03)',
    overflow: 'hidden',
  },
  trackStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.06)',
  },
  trackStripNum: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
    width: 20,
  },
  trackStripName: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 14,
    color: '#f1ebe0',
  },
  trackStripMomentCount: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
  },
  trackMoments: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 10,
    gap: 8,
  },
  trackMomentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  trackMomentText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.8)',
  },
});
