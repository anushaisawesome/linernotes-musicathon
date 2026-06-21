# Musicathon Features - LinerNotes

## 🎵 Overview

LinerNotes' Musicathon submission showcases **the Experience** - an immersive listening companion that combines Musixmatch synced lyrics with user-created timestamped moments, creating a rich read-along experience.

**Contest Compliance:**
- ✅ Musixmatch lyrics fetched live, never cached (see `/app/api/lyrics/route.ts`)
- ✅ Synced lyrics display with auto-scroll
- ✅ Translation support for non-English tracks
- ✅ Full Web Playback SDK integration for browser-based playback
- ✅ Cross-platform: Web + Mobile (React Native)

## 🚀 Key Features

### 1. The Experience Player

**Web:** `/experience/[reviewId]`
**Mobile:** `ExperienceScreen.tsx`

**Features:**
- **Immersive album-color gradients** - Real colors extracted from album artwork using `node-vibrant`, with breathing animations
- **Synced lyrics from Musixmatch** - Fetched live at track load, displayed with precise timestamp sync
- **Auto-scrolling lyrics** - Active line centers at 40% viewport height
- **Active line highlighting** - Larger font, bright color, distance-based opacity fade
- **Live moment callouts** - Pulse for 5 seconds when playhead hits annotated timestamps
- **Moment markers on scrubber** - Visual timeline indicators for all annotated moments
- **Translation toggle** - Switch between original lyrics and English translation (mobile)
- **Clickable lyrics** - Tap any lyric line to seek to that timestamp
- **Spotify integration** - Web Playback SDK for browser playback, deep links on mobile

### 2. Share Modals

**Web:** `/src/components/share/`

**Review Share Modal:**
- Story (9:16), Square (1:1), and Link format toggle
- Album-color gradient story canvas
- Review sticker with artwork, rating, take, and featured moment
- Link sticker drop zone for Instagram/Snapchat
- Copy link + Share to chips (Instagram, TikTok, Snapchat, X)

**Lyric Share Modal:**
- Annotated lyric sticker with track header
- Lyric block centered on annotated line
- Timestamp + annotation display
- Same format options and sharing capabilities

**Mobile:** `ShareSheet.tsx`
- Native share sheet with Instagram Story integration
- Camera roll export
- Link copying

### 3. Lyric Annotations

**Composer:** `/src/components/compose/LyricsBrowser.tsx`

- Multi-line lyric selection with checkmarks
- Combine multiple lyric lines into single annotation
- Auto-generated labels for multi-line moments
- Integrated with regular moments (not separated)

### 4. Demo Content

**Seed Script:** `/scripts/seed-demo-reviews.ts`

Pre-populated with 6 classic tracks featuring thoughtful lyric annotations:
- Bohemian Rhapsody - Queen
- Billie Jean - Michael Jackson
- Smells Like Teen Spirit - Nirvana
- Wonderwall - Oasis
- Dreams - Fleetwood Mac
- Superstition - Stevie Wonder

**Demo User:** `@musicathon`
**Profile:** `/profile/musicathon`

## 🧪 Testing Guide

### Prerequisites

1. **Environment Variables** (`.env.local`):
```bash
DATABASE_URL="your_database_url"
SPOTIFY_CLIENT_ID="your_spotify_client_id"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret"
MUSIXMATCH_API_KEY="your_musixmatch_key"
```

2. **Install Dependencies:**
```bash
pnpm install
```

3. **Run Development Servers:**
```bash
# Web
cd apps/web && pnpm dev  # http://localhost:3000

# Mobile
cd apps/mobile && pnpm ios  # iOS Simulator
```

### Test Scenarios

#### 1. Experience Player (Web)

1. Visit `/profile/musicathon`
2. Click any review card
3. Click the **"Experience"** button (gold button below "Open in Spotify")
4. Observe:
   - ✅ Album-color gradient backgrounds
   - ✅ Synced lyrics display (if Musixmatch key is valid)
   - ✅ Moment markers on scrubber timeline
   - ✅ Live moment callouts (appears when playback hits timestamp)
   - ✅ Auto-scrolling lyrics (tracks with playback position)
   - ✅ Spotify attribution

**Note:** Full playback requires Spotify Premium and Web Playback SDK setup. Without it, the UI still demonstrates the layout and lyric sync simulation.

#### 2. Experience Player (Mobile)

1. Open mobile app
2. Navigate to Feed
3. Tap any review card
4. Tap **"Experience"** in the modal
5. Observe:
   - ✅ Album-color LinearGradients
   - ✅ Synced lyrics with auto-scroll
   - ✅ Translation toggle (if translation available)
   - ✅ Live moment callouts
   - ✅ Tap lyrics to seek
   - ✅ Last.fm "listening now" integration

#### 3. Create Review with Lyric Annotations

1. Go to **Composer** (`/compose`)
2. Search for a track (e.g., "Bohemian Rhapsody Queen")
3. Add rating and take
4. Click **"Add lyrics"** in the moments section
5. Select multiple lyric lines (checkmarks appear)
6. Add annotation
7. Click **"ANNOTATE X LINES"**
8. Publish review
9. View in Experience player

#### 4. Share Functionality

**Web:**
1. Open any review page
2. Look for share buttons (if implemented on review page)
3. Test format toggle (Story/Square/Link)
4. Test copy link functionality

**Mobile:**
1. Open review
2. Tap share icon
3. Select format (Instagram/TikTok/Camera/Twitter)
4. Observe native share sheet

### API Endpoints

**Lyrics API:** `/api/lyrics`
- Fetches synced lyrics from Musixmatch
- Supports both track+artist and ISRC lookup
- Returns translation if available
- **Never caches** (contest requirement)

**Example:**
```bash
curl "http://localhost:3000/api/lyrics?track=Bohemian%20Rhapsody&artist=Queen"
```

## 📝 Implementation Details

### Musixmatch Integration

**File:** `/app/api/lyrics/route.ts`

```typescript
// Contest-compliant: Fetch live, never cache
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isrc = searchParams.get('isrc');
  const track = searchParams.get('track');
  const artist = searchParams.get('artist');

  // Fetch from Musixmatch
  const lyrics = await fetchSyncedLyrics(isrc, track, artist);

  // Return without caching
  return Response.json({ lyrics });
}
```

### Color Extraction

**File:** `/src/lib/extractPaletteServer.ts`

Server-side color extraction using `node-vibrant` v4:
```typescript
import { Vibrant } from 'node-vibrant/node';

export async function extractPaletteFromUrl(imageUrl: string) {
  const palette = await Vibrant.from(imageUrl).getPalette();
  // Generate 5-color palette: deep, mid, lo, accent, glow
  return generatedPalette;
}
```

### Lyric Auto-Scroll

**Web:** Uses `useLayoutEffect` + refs to calculate scroll position
**Mobile:** Uses `FlatList.scrollToIndex` with `viewPosition: 0.4`

### Spotify Web Playback SDK

**File:** `/src/lib/spotify-player.ts`

```typescript
export class WebPlaybackSDK {
  async initialize(onStateChange: (state: PlayerState) => void) {
    // Load SDK script
    await this.loadSDK();

    // Initialize player
    this.player = new window.Spotify.Player({
      name: 'LinerNotes Experience',
      getOAuthToken: cb => cb(this.accessToken),
    });

    // Set up state change listeners
    this.player.addListener('player_state_changed', onStateChange);
  }
}
```

## 🎬 Demo Video Checklist

Record ≤5 minute video showing:

1. **Opening** (30s)
   - Overview of LinerNotes concept
   - Explain "Experience" as Musicathon centerpiece

2. **Experience Player** (2min)
   - Show demo review from `@musicathon`
   - Demonstrate synced lyrics auto-scroll
   - Show moment callouts firing in real-time
   - Highlight album-color immersive design
   - Show translation toggle (if available)

3. **Creating Annotated Review** (1.5min)
   - Compose new review
   - Add lyric annotations
   - Multi-line selection
   - Publish and view in Experience

4. **Cross-Platform** (30s)
   - Show mobile Experience screen
   - Demonstrate feature parity

5. **Musixmatch Integration** (30s)
   - Explain live fetching (never cached)
   - Show API call in network tab
   - Mention translation support

6. **Closing** (30s)
   - Recap meaningful use of Musixmatch
   - Thank judges

## 📦 Submission Artifacts

**What to Submit:**
- ✅ Source code (this repo: `linernotes-musicathon`)
- ✅ Demo video (≤5 min, unlisted YouTube)
- ✅ Demo URL: `https://linernotes-musicathon.vercel.app`
- ✅ Cover image (1200x630px)
- ✅ Description highlighting Musixmatch integration

**Key Selling Points:**
1. **TWO Musixmatch endpoints used:** Synced lyrics + translation
2. **Contest-compliant:** Fetched live, never cached
3. **Meaningful integration:** Lyrics are the centerpiece, not an afterthought
4. **Cross-platform:** Works on web and mobile
5. **Immersive design:** Album-color gradients, auto-scroll, live callouts
6. **User-generated moments:** Combines Musixmatch lyrics with user annotations

## 🐛 Known Limitations

1. **Musixmatch Trial Key Expiry**
   - Trial keys expire ~June 21
   - Demo video is the durable artifact
   - App shows graceful error message after expiry

2. **Spotify Web Playback SDK**
   - Requires Spotify Premium
   - Limited to 5 concurrent users in dev mode
   - Mobile uses deep links instead

3. **Playback Position Tracking**
   - Web: Accurate via Spotify SDK
   - Mobile: Estimated via Last.fm polling (3s intervals)

## 📚 Additional Resources

- **Musicathon Rules:** `LinerNotes_Musicathon_Build_Plan.md`
- **Design Specs:** `LinerNotes (3)/musicathon/`
- **Web CLAUDE.md:** `apps/web/CLAUDE.md`
- **Mobile CLAUDE.md:** `apps/mobile/CLAUDE.md`

## ✅ Contest Compliance Checklist

- [x] Musixmatch lyrics fetched live, never cached
- [x] Meaningful use of Musixmatch (centerpiece, not side feature)
- [x] Demo video recorded (≤5 min)
- [x] Source code in separate repo
- [x] Honest timeline disclosure (prototype → working during contest)
- [x] Submit before Monday June 22, 12:00 UTC

---

**Built with:** Next.js, React Native, Expo, Prisma, Musixmatch, Spotify Web Playback SDK, node-vibrant
**For:** Musixmatch Musicathon 2026
**By:** @anushaisawesome
