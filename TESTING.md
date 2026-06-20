# Testing the Musixmatch Experience

## Prerequisites
- Spotify Premium account (required for Web Playback SDK)
- At least one review with timestamped notes in the database

## Steps to Test

### 1. Create a Review with Timestamped Notes

1. Go to `/log` on your deployed site
2. Search for a track (e.g., "Blinding Lights" by The Weeknd)
3. Add a rating (e.g., 5 stars)
4. Add timestamped moments:
   - Click "Add moment"
   - Enter timestamp (e.g., `1:23` for 1 minute 23 seconds)
   - Add a note (e.g., "The synth drop is incredible")
   - Add a label (optional, e.g., "The Drop")
5. Submit the review

### 2. Test the Experience

1. Find your review ID from the database or `/feed`
2. Navigate to `/experience/[review-id]`
3. The Experience should:
   - Load the review
   - Initialize Spotify Web Playback SDK
   - Fetch Musixmatch synced lyrics for the track
   - Start playing the song (if you have Spotify Premium)
   - Show synced lyrics highlighting in real-time
   - Display your timestamped note when playback reaches that point
   - Mark moments in the lyrics when passed

### 3. Expected Behavior

**On Load:**
- Album artwork displays
- "Loading Experience..." message appears
- Spotify player initializes
- Lyrics fetch from Musixmatch

**During Playback:**
- Current lyric line is highlighted and larger
- Previous/future lines are dimmed
- Your timestamped notes appear in a highlighted box when reached
- Moments are marked in the lyrics with accent color + border
- Playback controls show current position

**Graceful Degradation:**
- If Musixmatch key expires: Shows message "See the video for full experience"
- If no synced lyrics: Shows "No synced lyrics available"
- If Spotify fails: Shows error but doesn't crash

## Common Issues

### "Failed to get Spotify token"
- Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Vercel env vars
- Make sure you're logged in

### "No synced lyrics available"
- Not all tracks have synced lyrics in Musixmatch
- Try popular tracks like:
  - "Blinding Lights" by The Weeknd
  - "Shape of You" by Ed Sheeran
  - "Levitating" by Dua Lipa

### Player won't initialize
- Requires Spotify Premium account
- Check browser console for errors
- Try in Chrome (best compatibility)

## Creating Test Data

### Sample tracks with good Musixmatch coverage:
1. **Blinding Lights** - The Weeknd
   - ISRC: `USUG11902988`
   - Good synced lyrics
   - Try timestamping: 0:43 (first chorus), 1:52 (bridge)

2. **Levitating** - Dua Lipa
   - Good synced lyrics
   - Try timestamping: 0:35 (pre-chorus), 2:14 (bridge)

3. **good 4 u** - Olivia Rodrigo
   - Good synced lyrics
   - Try timestamping: 0:30 (chorus), 1:47 (bridge)

## Demo Video Checklist

Record the following:
1. ✅ Navigate to a review with timestamped notes
2. ✅ Experience loads, shows album art
3. ✅ Song starts playing
4. ✅ Lyrics highlight line-by-line in real-time
5. ✅ Timestamped note appears at exact moment (THE MONEY SHOT)
6. ✅ Moment is marked in the lyrics
7. ✅ Show playback controls working (pause/seek)
8. ✅ Quick tour of the feed, prompts, social features

**Duration:** ≤ 5 minutes
**Focus:** 60% on the Experience, 40% on the rest of the product
