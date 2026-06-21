/**
 * @linernotes/core/tokens
 *
 * Brand design tokens shared across web and mobile.
 * Based on Claude Design handoff (LinerNotes Mobile.html)
 */

// ============================================================================
// COLOR PALETTE - Musicathon Design System
// ============================================================================

export const colors = {
  /** Deep maroon background from Musicathon - #251214 */
  bg: '#251214',
  bgLight: '#f3ede1', // light mode

  /** Warm sand text - #f0e2cc */
  fg: '#f0e2cc',
  fgLight: '#23201b', // light mode
  fgRgb: '240,226,204', // for rgba()

  /** Line/border color */
  lineRgb: '255,255,255', // for rgba()

  /** Muted text */
  muted: '#aaa298',

  /** Gold accent - #e6b450 */
  gold: '#e6b450',
  goldBright: '#c8a45c',

  /** Coral accent - #d5896f */
  coral: '#d5896f',

  /** Oxblood card surface - #3e1e20 */
  surface: '#3e1e20',

  /** Reaction colors */
  flame: '#e0762f',
  love: '#d98aa0',
  skip: '#7a7468',

  /** Near-black for overlays */
  nearBlack: '#0a0908',

  /** Deep maroon for gradients - #1a0a0c */
  deepMaroon: '#1a0a0c',

  /** Garnet glow for backgrounds - #6e1a21 */
  garnet: '#6e1a21',
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  /** Font families - Musicathon design system */
  fonts: {
    /** Display/headlines - Syne for impactful titles */
    display: 'Syne',
    /** Album/track names - Newsreader serif */
    album: 'Newsreader',
    /** Body text - Hanken Grotesk */
    body: 'Hanken Grotesk',
    /** Monospace - Space Mono for labels/timestamps */
    mono: 'Space Mono',
    /** Preview/quotes - EB Garamond italic */
    preview: 'EB Garamond',
    /** Labels - uppercase tracking */
    label: 'Space Mono',
    /** Logo - system bold tracking */
    logo: 'System',
  },

  /** Font sizes - from Musicathon designs */
  sizes: {
    // App chrome
    appTitle: 23,
    betaBadge: 8.5,

    // Card
    cardTitle: 21,
    cardArtist: 13.5,
    previewLine: 17.5,
    momentNote: 12.5,

    // Feed
    userName: 13.5,
    userHandle: 10.5,
    actionButton: 12,

    // Composer
    composerTitle: 21,
    modeTab: 13,
    sectionLabel: 9.5,
    input: 15,
    effortLabel: 9,

    // Experience
    experienceTitle: 27,
    experienceArtist: 15,
    experienceQuote: 20,
    experienceBody: 14.5,
    lyricActive: 21,
    lyricInactive: 17,

    // Profile
    profileName: 23,
    profileHandle: 12,
    statNumber: 16,
    statLabel: 9.5,

    // General
    body: 13.5,
    caption: 10.5,
    label: 11.5,
  },

  /** Font weights */
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '800' as const,
  },
} as const;

// ============================================================================
// LAYOUT
// ============================================================================

export const layout = {
  /** Spacing - Musicathon design system */
  spacing: {
    xs: 4,
    sm: 8,
    md: 13,    // Composer sections, common gap
    lg: 18,
    xl: 26,    // Profile sections
    xxl: 32,
  },

  /** Border radius - from Musicathon */
  radius: {
    card: 18,
    pill: 999,
    button: 12,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,    // Share cards, composer
    sheet: 22, // Bottom sheets
  },

  /** Feed spacing */
  feedGap: 28,        // Gap between feed items
  feedPadding: 16,

  /** Card padding by depth */
  cardPadding: {
    full: { vertical: 18, horizontal: 18 },
    caption: { vertical: 15, horizontal: 17 },
    floor: { vertical: 16, horizontal: 17 },
  },

  /** Composer spacing */
  composer: {
    padding: 18,
    sectionGap: 20,
    inputPadding: 12,
  },

  /** Profile spacing */
  profile: {
    padding: 18,
    sectionGap: 28,
    top4Gap: 13,
  },
} as const;

// ============================================================================
// CARD LAYOUT
// ============================================================================

export const card = {
  /** Album art placement */
  artworkPosition: {
    /** Album Art Dominant: top 60% */
    dominant: {
      top: 0,
      height: '60%',
    },
    /** Balanced: top 40% */
    balanced: {
      top: 0,
      height: '40%',
    },
  },

  /** Content overlay (bottom 40% or 60%) */
  overlayGradient: {
    /** For Album Art Dominant variant */
    dominant: 'linear-gradient(180deg, rgba(10, 10, 10, 0) 0%, rgba(10, 10, 10, 0.85) 40%, rgba(10, 10, 10, 1) 100%)',
    /** For balanced variant */
    balanced: 'linear-gradient(180deg, rgba(10, 10, 10, 0.6) 0%, rgba(10, 10, 10, 1) 60%)',
  },

  /** Timestamp notch positioning */
  notch: {
    /** Distance from top of content area */
    offsetY: -12,
    /** Width */
    width: 120,
    /** Height */
    height: 40,
    /** Background */
    background: colors.gold,
    /** Text color */
    color: colors.nearBlack,
  },
} as const;

// ============================================================================
// ICONS & REACTIONS
// ============================================================================

export const reactions = {
  flame: {
    icon: '🔥',
    label: 'Standout',
    color: '#FF6B35',
  },
  love: {
    icon: '❤️',
    label: 'Love',
    color: '#FF3366',
  },
  skip: {
    icon: '⏭️',
    label: 'Skip',
    color: '#6B7280',
  },
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export const tokens = {
  colors,
  typography,
  layout,
  card,
  reactions,
} as const;

export default tokens;
