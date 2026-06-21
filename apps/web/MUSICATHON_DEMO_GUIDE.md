# Musicathon Demo Guide

## 🎯 What We Built

The **LinerNotes Experience** - an immersive music listening experience with:
- ✅ Album-color gradient backgrounds with breathing animations
- ✅ Synced lyrics with auto-scroll
- ✅ Live moment callouts that pulse when reached
- ✅ Timeline markers for annotated moments
- ✅ Share modals for reviews and lyric moments (Story/Square/Link)
- ✅ Full Spotify Web Playback SDK integration

## 🧪 Testing Checklist

### Prerequisites
- [ ] Spotify Premium account (required for Web Playback SDK)
- [ ] Connected Spotify account in LinerNotes settings

### Experience Player Testing

Visit `/profile/musicathon` to see the demo reviews, then test:

1. **Basic Playback**
   - [ ] Click "Experience" button on any demo review
   - [ ] Player loads with album-color gradient background
   - [ ] Track starts playing through Spotify SDK
   - [ ] Play/pause controls work
   - [ ] Previous/next track controls work

2. **Synced Lyrics**
   - [ ] Lyrics appear on screen
   - [ ] Active line highlights as song plays
   - [ ] Lyrics auto-scroll to keep active line centered
   - [ ] Clicking a lyric line seeks to that timestamp

3. **Moment Markers**
   - [ ] Orange markers appear on scrubber timeline
   - [ ] Markers correspond to annotated moments
   - [ ] When playback reaches a moment, callout appears on right
   - [ ] Callout pulses and fades after 5 seconds
   - [ ] Clicking marker in callout seeks to that moment

4. **Visual Polish**
   - [ ] Gradient background "breathes" with subtle animation
   - [ ] EQ visualizer bars pulse with music
   - [ ] Album art displays correctly
   - [ ] Track info and user info render properly
   - [ ] Reviewer note card can collapse/expand

5. **Share Modals**
   - [ ] Click share icon on review page
   - [ ] Modal opens with Story/Square/Link format toggle
   - [ ] Preview updates when switching formats
   - [ ] Copy link works
   - [ ] Download image works (Story/Square formats)

### Best Demo Tracks

These have great moments and synced lyrics:

1. **Bohemian Rhapsody** - Shows off the full 6-minute epic journey
   - Piano intro → operatic section → headbanging moment

2. **Billie Jean** - Iconic bassline, simple but perfect
   - Clean, minimal lyrics make auto-scroll super clear

3. **Smells Like Teen Spirit** - High energy, shows lyric sync timing
   - The quiet→loud dynamics work great with moment callouts

## 🎥 Demo Video Script (2-3 minutes)

### Opening (0:00-0:20)
- Show home feed scrolling through reviews
- Highlight review with "Experience" button
- **Voiceover**: "LinerNotes lets you add timestamped notes to your music reviews. But what if you could experience those moments in real-time?"

### The Experience (0:20-1:30)
- Click "Experience" button
- Player loads with gradient background
- **Voiceover**: "The Experience player brings your annotated reviews to life"
- Show:
  - Synced lyrics scrolling
  - Moment marker on timeline
  - Live callout appearing when moment is reached
  - Click on callout to jump back to that moment
- **Voiceover**: "As the song plays, your notes pulse onto the screen at exactly the right moment"

### Visual Design (1:30-1:50)
- Zoom in on gradient background
- Show it breathing/pulsing
- **Voiceover**: "Album colors flood the screen with dynamic gradients extracted from the artwork"
- Show EQ visualizer
- Show reviewer note card expanding

### Sharing (1:50-2:20)
- Exit back to review page
- Click share button
- Show Story format → Square format toggle
- Show lyric moment share modal
- **Voiceover**: "Share your favorite moments as Instagram Stories or save them as cards"

### Closing (2:20-2:30)
- Quick montage of 3-4 different tracks in Experience mode
- **Voiceover**: "LinerNotes Experience - where music reviews become immersive listening sessions"
- Show logo/link

## 📸 Screenshot Recommendations

Capture these for submission:

1. **Hero shot**: Experience player with Bohemian Rhapsody at the operatic section
2. **Moment callout**: Live callout pulsing on screen
3. **Timeline**: Scrubber with multiple moment markers
4. **Share modal**: Story format preview
5. **Mobile view**: If mobile Experience is implemented

## 🐛 Known Issues to Avoid in Demo

- Musixmatch API sometimes returns no lyrics (pick tracks that work)
- Spotify SDK requires Premium (mention this in demo)
- First play might take 2-3 seconds to initialize device
- Some tracks don't have preview URLs (use popular tracks that do)

## 🎬 Recording Tips

1. **Use screen recording software**: QuickTime (Mac) or OBS (cross-platform)
2. **Record at 1080p**: Looks professional and doesn't take too long to export
3. **Hide bookmarks bar**: Clean browser chrome
4. **Use incognito/guest mode**: No personal info in screenshots
5. **Pre-load pages**: Don't show loading spinners in final cut
6. **Add background music**: Use instrumental version of one of the demo tracks
7. **Keep it snappy**: 2-3 minutes max, 60-90 seconds ideal

## 📝 Submission Checklist

- [ ] Test all features work end-to-end
- [ ] Record demo video
- [ ] Export video (MP4, H.264)
- [ ] Take screenshots
- [ ] Write submission description highlighting:
  - Musixmatch synced lyrics integration
  - Real-time moment annotations
  - Album color extraction
  - Spotify Web Playback SDK
  - Share/export features
- [ ] Submit before deadline!

## 🔗 Demo User Profile

**Visit**: `/profile/musicathon`

This profile has 6 carefully curated demo reviews:
- Each has 2-3 thoughtful moment annotations
- Mix of iconic tracks across genres
- All have good Musixmatch lyrics coverage
- Comments explain *why* each moment matters

Good luck! 🎵
