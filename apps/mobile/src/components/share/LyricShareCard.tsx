/**
 * LyricShareCard - Musicathon mobile share card for lyric moments
 * Annotated lyric sticker with track header
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../../lib/tokens';
import type { FeedReview } from '../../lib/feed-types';

interface LyricShareCardProps {
  review: FeedReview;
  moment: {
    sec: number;
    label?: string;
    note: string;
    lyric?: string;
  };
  format: 'story' | 'square';
  linkSlot?: boolean;
}

export function LyricShareCard({ review, moment, format, linkSlot = false }: LyricShareCardProps) {
  const { album, user } = review;
  const p = album.palette;
  const gold = tokens.colors.gold;
  const isStory = format === 'story';

  // Fixed width for proper aspect ratio (Story: 360px @ 9:16, Square: 360px @ 1:1)
  const cardWidth = 360;

  return (
    <View style={[styles.container, { width: cardWidth, aspectRatio: isStory ? 9/16 : 1 }]}>
      {/* Album-color gradient flood */}
      <LinearGradient
        colors={[p.mid, p.deep, p.lo]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.5, y: 0.08 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${p.glow}66`, 'transparent']}
        start={{ x: 0.84, y: 0.92 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { padding: isStory ? 20 : 14 }]}>
        {/* LinerNotes branding */}
        <Text style={[styles.brand, { fontSize: isStory ? 17 : 15 }]}>
          LinerNotes
        </Text>

        {/* Lyric sticker */}
        <View style={[styles.sticker, { marginTop: isStory ? 16 : 12 }]}>
          {/* Track header */}
          <View style={[styles.header, { padding: isStory ? 14 : 12, backgroundColor: `${gold}1c` }]}>
            <View style={[styles.headerArt, { width: isStory ? 46 : 40, height: isStory ? 46 : 40 }]}>
              {album.artworkUrl ? (
                <Image source={{ uri: album.artworkUrl }} style={styles.headerArtImage} resizeMode="cover" />
              ) : (
                <View style={[styles.headerArtImage, styles.headerArtPlaceholder]} />
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTrack, { fontSize: isStory ? 18 : 16 }]} numberOfLines={1}>
                {album.title}
              </Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {album.artist} · {album.year || 'Single'}
              </Text>
            </View>
          </View>

          {/* Lyric block */}
          <View style={[styles.lyricSection, { padding: isStory ? 16 : 13 }]}>
            <View style={styles.lyricBar} />
            <Text style={[styles.lyric, { fontSize: isStory ? 19 : 16.5 }]}>
              {moment.lyric || 'No lyric text'}
            </Text>
          </View>

          {/* Annotation */}
          <View style={[styles.annotationSection, { padding: isStory ? 12 : 10 }]}>
            <View style={[styles.annotation, { backgroundColor: `${gold}16`, borderColor: `${gold}3a`, padding: isStory ? 11 : 9 }]}>
              <View style={styles.annotationTime}>
                <Text style={styles.annotationTimeText}>
                  {Math.floor(moment.sec / 60)}:{(moment.sec % 60).toString().padStart(2, '0')}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {moment.label && (
                  <Text style={styles.annotationLabel}>
                    {moment.label}
                  </Text>
                )}
                <Text style={[styles.annotationNote, { fontSize: isStory ? 14 : 13 }]} numberOfLines={isStory ? 4 : 3}>
                  {moment.note}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Link sticker zone (Story only) */}
        {isStory && linkSlot && (
          <View style={styles.linkSlot}>
            <View style={styles.linkIcon}>
              <Text style={styles.linkIconText}>🔗</Text>
            </View>
            <Text style={styles.linkSlotLabel}>Link sticker</Text>
            <Text style={styles.linkSlotHint}>
              taps open the Experience here
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* User handle */}
        <Text style={styles.handle}>
          @{user?.handle || 'user'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 22,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  brand: {
    fontFamily: 'System',
    fontWeight: '800',
    color: '#f4ecdd',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sticker: {
    borderRadius: 16,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 38,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  headerArt: {
    borderRadius: 9,
    overflow: 'hidden',
  },
  headerArtImage: {
    width: '100%',
    height: '100%',
  },
  headerArtPlaceholder: {
    backgroundColor: 'rgba(241,235,224,0.08)',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTrack: {
    fontFamily: 'System',
    fontWeight: '600',
    color: tokens.colors.fg,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  headerMeta: {
    fontFamily: 'System',
    fontSize: 12,
    color: tokens.colors.muted,
    marginTop: 1,
  },
  lyricSection: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 6,
  },
  lyricBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: tokens.colors.gold,
  },
  lyric: {
    flex: 1,
    fontFamily: 'System',
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 25,
    color: tokens.colors.fg,
  },
  annotationSection: {
    paddingTop: 0,
  },
  annotation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  annotationTime: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#e6b450',
    marginTop: 1,
  },
  annotationTimeText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2c1517',
    letterSpacing: -0.3,
  },
  annotationLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: tokens.colors.gold,
    marginBottom: 2,
  },
  annotationNote: {
    fontFamily: 'System',
    lineHeight: 19,
    color: 'rgba(241,235,224,0.86)',
  },
  linkSlot: {
    marginTop: 14,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(213,137,111,0.6)',
    backgroundColor: 'rgba(213,137,111,0.12)',
    alignItems: 'center',
    gap: 5,
  },
  linkIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: tokens.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconText: {
    fontSize: 11,
  },
  linkSlotLabel: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#f4ecdd',
  },
  linkSlotHint: {
    fontFamily: 'Menlo',
    fontSize: 9,
    color: 'rgba(244,236,221,0.66)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  handle: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(244,236,221,0.72)',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
