/**
 * ReviewShareCard - Musicathon mobile share card for reviews
 * Renders as Story (9:16) or Square (1:1) format with album-color gradients
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../../lib/tokens';
import { Stars } from '../atoms/Stars';
import type { FeedReview } from '../../lib/feed-types';

interface ReviewShareCardProps {
  review: FeedReview;
  format: 'story' | 'square';
  linkSlot?: boolean; // Show link sticker zone for Instagram
}

export function ReviewShareCard({ review, format, linkSlot = false }: ReviewShareCardProps) {
  const { album, rating, user } = review;
  const p = album.palette;
  const gold = tokens.colors.gold;
  const isStory = format === 'story';
  const featuredMoment = review.notes && review.notes.length > 0 ? review.notes[0] : null;

  // Fixed width for proper aspect ratio (Story: 360px @ 9:16, Square: 360px @ 1:1)
  const cardWidth = 360;

  return (
    <View style={[styles.container, { width: cardWidth, aspectRatio: isStory ? 9/16 : 1 }]}>
      {/* Album-color gradient flood */}
      <LinearGradient
        colors={[p.mid, p.deep, p.lo]}
        locations={[0, 0.56, 1]}
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

      {/* Diagonal stripe texture */}
      <View style={styles.stripeOverlay} />

      <View style={[styles.content, { padding: isStory ? 20 : 14 }]}>
        {/* LinerNotes branding */}
        <Text style={[styles.brand, { fontSize: isStory ? 17 : 15 }]}>
          LinerNotes
        </Text>

        {/* Review sticker */}
        <View style={[styles.sticker, { marginTop: isStory ? 16 : 12 }]}>
          {/* Album art */}
          <View style={styles.artContainer}>
            {album.artworkUrl ? (
              <Image source={{ uri: album.artworkUrl }} style={styles.artwork} resizeMode="cover" />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]}>
                <Text style={styles.artworkLabel}>{album.title?.toLowerCase()}</Text>
              </View>
            )}
            {rating > 0 && (
              <View style={styles.ratingBadge}>
                <Stars rating={rating} size={9} color="#e6b450" showNum={false} />
              </View>
            )}
          </View>

          {/* Track info */}
          <View style={[styles.stickerBody, { padding: isStory ? 13 : 11 }]}>
            <Text style={[styles.trackName, { fontSize: isStory ? 19 : 17 }]} numberOfLines={1}>
              {album.title}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {album.artist}
            </Text>

            {/* Review take */}
            {review.take && (
              <Text style={[styles.take, { fontSize: isStory ? 15.5 : 14, marginTop: isStory ? 9 : 7 }]} numberOfLines={isStory ? 3 : 2}>
                {review.take}
              </Text>
            )}

            {/* Featured moment */}
            {featuredMoment && (
              <View style={[styles.moment, { backgroundColor: `${gold}16`, borderColor: `${gold}3a`, padding: isStory ? 9 : 7, marginTop: isStory ? 9 : 7 }]}>
                <View style={[styles.momentTime, { backgroundColor: '#e6b450' }]}>
                  <Text style={styles.momentTimeText}>
                    {Math.floor(featuredMoment.sec / 60)}:{(featuredMoment.sec % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.momentLabel, { fontSize: isStory ? 12.5 : 11.5 }]} numberOfLines={1}>
                    {featuredMoment.label || 'moment'}
                  </Text>
                  {featuredMoment.note && (
                    <Text style={[styles.momentNote, { fontSize: isStory ? 12.5 : 11.5 }]} numberOfLines={isStory ? 2 : 1}>
                      {featuredMoment.note}
                    </Text>
                  )}
                </View>
              </View>
            )}
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
              {review.take ? 'taps reach the full note' : 'taps open this note'}
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
  stripeOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    // Simulated diagonal stripes (would need SVG for real implementation)
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
    width: '100%',
    borderRadius: 16,
    backgroundColor: tokens.colors.bg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  artContainer: {
    position: 'relative',
    aspectRatio: 1,
    width: '100%',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(8,7,6,0.6)',
  },
  stickerBody: {
    paddingBottom: 15,
  },
  trackName: {
    fontFamily: 'System',
    fontWeight: '600',
    color: tokens.colors.fg,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  artistName: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: tokens.colors.muted,
    marginTop: 1,
  },
  take: {
    fontFamily: 'System',
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 21,
    color: tokens.colors.fg,
  },
  moment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  momentTime: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 1,
  },
  momentTimeText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2c1517',
    letterSpacing: -0.3,
  },
  momentLabel: {
    fontFamily: 'System',
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  momentNote: {
    fontFamily: 'System',
    lineHeight: 17,
    color: 'rgba(var(--ln-fg-rgb),0.7)',
    marginTop: 1,
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
