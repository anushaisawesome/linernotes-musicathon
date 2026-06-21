/**
 * Mobile Lyrics Browser - for creating rich reviews with timestamped moments
 * Supports inline translations for non-English tracks
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../lib/tokens';
import type { Moment } from '../lib/types';

interface LyricLine {
  text: string;
  seconds: number;
}

interface LyricsBrowserProps {
  trackName: string;
  artistName: string;
  onBookmark: (moment: Moment) => void;
  bookmarkedLines: Set<string>;
}

export function LyricsBrowser({
  trackName,
  artistName,
  onBookmark,
  bookmarkedLines
}: LyricsBrowserProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [translation, setTranslation] = useState<LyricLine[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotation, setAnnotation] = useState('');

  useEffect(() => {
    if (!trackName || !artistName) return;

    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('track', trackName);
        params.set('artist', artistName);

        // Use the API from the web app (assuming same backend)
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/lyrics?${params.toString()}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'No lyrics available');
        }

        const data = await res.json();

        if (data.lyrics && Array.isArray(data.lyrics)) {
          const parsedLyrics = data.lyrics.map((line: any) => ({
            text: line.text || '',
            seconds: line.time?.total ? line.time.total / 1000 : 0,
          })).filter((line: LyricLine) => line.text.trim() !== '');

          setLyrics(parsedLyrics);

          // Check for translation
          if (data.translation && Array.isArray(data.translation)) {
            const parsedTranslation = data.translation.map((line: any) => ({
              text: line.text || '',
              seconds: line.time?.total ? line.time.total / 1000 : 0,
            })).filter((line: LyricLine) => line.text.trim() !== '');

            setTranslation(parsedTranslation);
            setShowTranslation(true); // Show translation by default
          } else {
            setTranslation([]);
            setShowTranslation(false);
          }
        } else {
          setError('No synced lyrics available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lyrics');
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [trackName, artistName]);

  const handleLineClick = (index: number) => {
    if (bookmarkedLines.has(lyrics[index].text)) return;

    setSelectedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleStartAnnotation = () => {
    if (selectedLines.size === 0) return;
    setIsAnnotating(true);
    setAnnotation('');
  };

  const commitBookmark = (noteText: string) => {
    if (selectedLines.size === 0) return;

    const selectedLyrics = Array.from(selectedLines)
      .sort((a, b) => a - b)
      .map(idx => lyrics[idx]);

    const firstLine = selectedLyrics[0];
    const combinedLyric = selectedLyrics.map(l => l.text).join('\n');
    const label = selectedLyrics.length > 1
      ? `${selectedLyrics.length} lines from ${formatTimestamp(firstLine.seconds)}`
      : firstLine.text.substring(0, 50) + (firstLine.text.length > 50 ? '...' : '');

    onBookmark({
      seconds: firstLine.seconds,
      label,
      note: noteText.trim(),
      lyric: combinedLyric,
    });

    setSelectedLines(new Set());
    setIsAnnotating(false);
    setAnnotation('');
  };

  const handleSaveAnnotation = () => commitBookmark(annotation);

  const handleCancelAnnotation = () => {
    setSelectedLines(new Set());
    setIsAnnotating(false);
    setAnnotation('');
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={tokens.colors.gold} />
        <Text style={styles.loadingText}>Fetching synced lyrics from Musixmatch...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Lyrics may not be available for this track</Text>
      </View>
    );
  }

  if (lyrics.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No lyrics found for this track</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.instructionText}>
          {selectedLines.size > 0
            ? `${selectedLines.size} line${selectedLines.size > 1 ? 's' : ''} selected. Tap to add/remove lines.`
            : 'Tap lines to select them, then save — adding an annotation is optional.'}
        </Text>
        {translation.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowTranslation(!showTranslation)}
            style={[
              styles.translationToggle,
              showTranslation && styles.translationToggleActive
            ]}
          >
            <Text style={[
              styles.translationToggleText,
              showTranslation && styles.translationToggleTextActive
            ]}>
              {showTranslation ? 'EN' : 'ORIG'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedLines.size > 0 && !isAnnotating && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleStartAnnotation}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              ANNOTATE {selectedLines.size} LINE{selectedLines.size > 1 ? 'S' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => commitBookmark('')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>SAVE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCancelAnnotation}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>CLEAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {isAnnotating && (
        <View style={styles.annotationBox}>
          <Text style={styles.annotationLabel}>
            Annotating {selectedLines.size} line{selectedLines.size > 1 ? 's' : ''}:
          </Text>
          <TextInput
            autoFocus
            placeholder="Add your annotation (optional)"
            placeholderTextColor={tokens.colors.muted}
            value={annotation}
            onChangeText={setAnnotation}
            onSubmitEditing={handleSaveAnnotation}
            style={styles.annotationInput}
            returnKeyType="done"
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleSaveAnnotation}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancelAnnotation}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.lyricsScroll}>
        {lyrics.map((line, index) => {
          const isBookmarked = bookmarkedLines.has(line.text);
          const isSelected = selectedLines.has(index);
          const translatedLine = translation[index];
          const timestamp = formatTimestamp(line.seconds);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleLineClick(index)}
              disabled={isBookmarked || isAnnotating}
              style={[
                styles.lineRow,
                isBookmarked && styles.lineRowBookmarked,
                isSelected && styles.lineRowSelected,
                isAnnotating && styles.lineRowDisabled,
              ]}
            >
              <Text style={[
                styles.timestamp,
                (isBookmarked || isSelected) && styles.timestampHighlight
              ]}>
                {timestamp}
              </Text>
              <View style={styles.lineContent}>
                <Text style={[
                  styles.lineText,
                  (isBookmarked || isSelected) && styles.lineTextHighlight
                ]}>
                  {line.text}
                </Text>
                {showTranslation && translatedLine && translatedLine.text !== line.text && (
                  <Text style={styles.translationText}>
                    {translatedLine.text}
                  </Text>
                )}
              </View>
              {isBookmarked && <Text style={styles.bookmarkIcon}>★</Text>}
              {isSelected && !isBookmarked && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.footerText}>
        {lyrics.length} synced lines · Powered by Musixmatch
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 13,
    color: tokens.colors.muted,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    margin: 16,
  },
  errorText: {
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 14,
    color: tokens.colors.muted,
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 12,
    color: tokens.colors.muted,
    textAlign: 'center',
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  instructionText: {
    flex: 1,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 13,
    color: tokens.colors.muted,
  },
  translationToggle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  translationToggleActive: {
    borderColor: tokens.colors.gold,
  },
  translationToggleText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10,
    color: tokens.colors.muted,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  translationToggleTextActive: {
    color: tokens.colors.gold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: tokens.colors.gold,
    borderWidth: 1,
    borderColor: tokens.colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.nearBlack,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.cream,
  },
  annotationBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${tokens.colors.gold}55`,
    borderRadius: 12,
    backgroundColor: `${tokens.colors.gold}08`,
  },
  annotationLabel: {
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 13,
    color: tokens.colors.cream,
    opacity: 0.7,
    marginBottom: 10,
  },
  annotationInput: {
    width: '100%',
    padding: 9,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 13,
    borderWidth: 1,
    borderColor: `${tokens.colors.gold}55`,
    borderRadius: 6,
    backgroundColor: tokens.colors.nearBlack,
    color: tokens.colors.cream,
    marginBottom: 10,
  },
  lyricsScroll: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: 16,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  lineRowBookmarked: {
    backgroundColor: `${tokens.colors.gold}15`,
  },
  lineRowSelected: {
    backgroundColor: `${tokens.colors.gold}22`,
  },
  lineRowDisabled: {
    opacity: 0.5,
  },
  timestamp: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    color: tokens.colors.muted,
    minWidth: 40,
  },
  timestampHighlight: {
    color: tokens.colors.gold,
  },
  lineContent: {
    flex: 1,
  },
  lineText: {
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: tokens.colors.cream,
  },
  lineTextHighlight: {
    color: tokens.colors.gold,
  },
  translationText: {
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  bookmarkIcon: {
    fontSize: 16,
    color: tokens.colors.gold,
  },
  checkIcon: {
    fontSize: 14,
    color: tokens.colors.gold,
    fontFamily: tokens.typography.fonts.mono,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 10,
    marginBottom: 16,
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10,
    color: tokens.colors.muted,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
