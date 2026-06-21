# LinerNotes Musicathon - Implementation Status & Plan

**Deadline: Monday June 22, 1pm BST (12:00 UTC)**

## ✅ What's Been Implemented (Sunday Morning)

### Experience Player (DONE)
- ✅ Immersive album-color gradients with breathing animations
- ✅ Musixmatch synced lyrics with karaoke-style highlighting
- ✅ Auto-scroll lyrics to keep current line centered
- ✅ Timestamped moment markers on scrubber timeline
- ✅ Live moment callouts that pulse when reached (5s duration)
- ✅ Web Playback SDK integration with transport controls
- ✅ Preview mode for judges (works without Spotify Premium)
- ✅ Full playback mode for logged-in Spotify users

### Authentication (DONE)
- ✅ Spotify OAuth with streaming scopes auto-enabled
- ✅ Auto-creates MusicConnection on Spotify login for immediate playback
- ✅ No separate "Connect Spotify" step needed

### Database (FIXED)
- ✅ Connection pool properly configured (max 3, auto-closes idle)
- ✅ All existing reviews and accounts preserved
- ✅ Ready for new users to populate reviews

### Share Modals (DONE)
- ✅ Review sharing (Story/Square/Link formats)
- ✅ Lyric moment sharing with annotated stickers
- ✅ Export index for easy imports

## 🚨 CRITICAL TASKS - TODAY (Sunday)

### 1. Test & Verify (NOW - 6pm)
**Owner: Anusha**

Test that everything works:
1. **Log out and log back in with Spotify**
   - Should request streaming permissions
   - Should create MusicConnection automatically

2. **Create a review with moment annotations**
   - Pick a popular song (Queen, Beatles, Taylor Swift - has Musixmatch lyrics)
   - Add 2-3 timestamped notes at key moments

3. **Open Experience and verify**:
   - ✅ Lyrics appear and sync with playback (karaoke-style)
   - ✅ Playback controls work (play/pause/prev/next)
   - ✅ Moment markers show on timeline
   - ✅ Moment callouts pulse when reached
   - ✅ Album-color gradients display

**If anything doesn't work, report errors from browser console immediately!**

### 2. Populate Reviews (Today 12pm - 11pm)
**Owner: Anusha + Abia + 2-3 Friends**

**Goal**: 10-15 reviews minimum with real timestamped annotations

**Steps**:
1. Text Abia + 2-3 friends RIGHT NOW
2. Give them the Vercel URL: `https://linernotes-musicathon.vercel.app`
3. Instructions for friends:
   ```
   1. Click "Sign in with Spotify"
   2. Log in (will request streaming permissions - click Accept)
   3. Create 2-3 reviews with moment annotations:
      - Search for a song
      - Rate it (0.5 - 5 stars)
      - Write a take (one line review)
      - Add 2-3 timestamped moments:
        - Play the song preview
        - Click "Add moment" at key points
        - Label each moment (e.g., "the drop", "chorus", "guitar solo")
        - Add a note explaining why that moment matters
   4. Done!
   ```

**Best songs for testing**:
- Popular tracks with Musixmatch lyrics (Queen, Beatles, Taylor Swift, Fleetwood Mac)
- Songs you genuinely love and can annotate meaningfully
- Mix of genres to show variety

### 3. Test Social Feed "via" Connections (Sunday Evening)
**Owner: Anusha + Abia**

With 3+ users in the system:
1. Have everyone follow each other
2. Check feed shows "via [friend]" for second-degree connections
3. Verify the social graph works as designed

### 4. Delete Demo Reviews (Sunday Evening)
**Owner: Anusha**

Once real reviews are populated:
```bash
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... DATABASE_URL="..." \
npx tsx scripts/delete-musicathon-user.ts
```

This removes the 6 auto-generated demo reviews under @musicathon user.

## 📋 MONDAY TASKS (Before 1pm BST)

### 1. Switch to Demo Mode (Monday Morning 9am-11am)
**Owner: Anusha**

**Option A: Hide Spotify Login (Safest)**
- Just remove Spotify button from login UI
- Keep everything else working
- Users stay in database, reviews stay visible

**Option B: Preview-Only Mode**
- Make entire site browseable without login
- All Experiences show preview mode (no playback for judges)
- Keep database intact

**Why**: Spotify OAuth dev mode = 25 user limit. Judges can't sign in anyway.

### 2. Record Demo Video (Monday 10am-12pm)
**Owner: Anusha**

**Length**: ≤5 minutes (aim for 3-4 min)

**Script** (from Musicathon guide):
1. **0:00-0:30** - Hook: Show Experience mid-playback (lyric syncing, moment pulsing)
2. **0:30-1:45** - Social feed: "via [friend]" connections, real reviews
3. **1:45-3:45** - Experience deep dive (CENTREPIECE):
   - Musixmatch synced lyrics scrolling
   - Timestamped moments appearing in sync
   - Album-color gradients
   - Timeline markers
4. **3:45-4:30** - Build story + honest timeline:
   - "Rough prototype week before → built this during contest"
   - Show Musixmatch integration explicitly
5. **4:30-4:50** - Close on the synced moment magic

**Tips**:
- Record at 1080p
- Use QuickTime (Mac) or OBS
- Hide bookmarks bar
- Pre-load pages (no loading spinners)
- Use popular track with good lyrics for demo

### 3. Write Submission (Monday 11am-12:30pm)
**Owner: Anusha**

Use the template from `Musicathon_CLAUDE.md`:

**Title**: LinerNotes — relive the moment a song hit you

**One-liner**: A music journaling app where, as a song plays, Musixmatch lyrics and your own timestamped reactions surface in sync — a review you relive, not read.

**Description**: (See Musicathon_CLAUDE.md for full text - paste ready)

**Cover Image**: Screenshot of Experience mid-playback (lyric lit up with moment)

### 4. Submit (Monday 12:00-12:45pm)
**Owner: Anusha**

Submit to Musicathon Hub with:
- Title
- One-liner
- Description
- Cover image
- Demo URL (Vercel)
- Video (<5 min)
- Source repo URL
- Team members (Anusha, Abia)

## 🐛 Known Issues & Fixes

### If Playback Doesn't Work
1. **Check**: Do you have Spotify Premium? (Web Playback SDK requires it)
2. **Check**: Did you log out and back in after the auth scope update?
3. **Check**: Browser console for `[Spotify Player]` errors

### If Lyrics Don't Show
- Musixmatch doesn't have lyrics for every track
- Try a different popular song (Queen, Beatles work well)
- Check console for `[Musixmatch]` errors

### If Reviews Disappear
- Database connection pool issue (already fixed)
- Wait 30-60s for connections to clear
- Refresh page

## 📁 Important Files

### Core Implementation
- `/app/experience/[id]/page.tsx` - Experience player
- `/src/lib/spotify-player.ts` - Web Playback SDK wrapper
- `/src/lib/sync-engine.ts` - Lyric sync logic
- `/app/api/lyrics/route.ts` - Musixmatch API proxy
- `/src/lib/auth.ts` - Spotify OAuth with streaming scopes

### Database
- `/prisma/schema.prisma` - Database schema
- `/src/lib/prisma.ts` - Connection pool config

### Scripts
- `/scripts/seed-demo-reviews.ts` - Demo review generator
- `/scripts/delete-musicathon-user.ts` - Remove demo user
- `/scripts/list-reviews.ts` - List all reviews

### Documentation
- `/MUSICATHON_DEMO_GUIDE.md` - Testing checklist & video script
- `/Musicathon_CLAUDE.md` - Submission guide from Downloads

## ⚠️ Critical Rules

1. **Never persist Musixmatch content** - Lyrics fetched live, in-memory only
2. **Keys server-side only** - Never expose Musixmatch API key to client
3. **Honest timeline** - "Rough prototype week before → built during contest"
4. **Open access** - Judges must be able to browse without login
5. **Deadline**: Monday June 22, 1pm BST (12:00 UTC)

## 🚀 Deployment Status

**Current**: All fixes deployed to `https://linernotes-musicathon.vercel.app`

**Branch**: `main`

**Last Deploy**: Sunday morning - auto-create MusicConnection + lyrics API fix

**Next Deploy**: After demo mode switch (Monday morning)

## 💬 Communication

**If something breaks**:
1. Check browser console for errors
2. Note exact error message
3. Report immediately with:
   - What you were doing
   - What you expected
   - What happened
   - Console errors

**Timezone**: All times in BST (British Summer Time)

**Deadline countdown**: ~28 hours remaining (as of Sunday 9am BST)

---

## Quick Start for Abia

**Right now**:
1. Go to https://linernotes-musicathon.vercel.app
2. Sign in with Spotify (will request streaming permissions)
3. Create 2-3 reviews with moment annotations
4. Test Experience works (playback + lyrics + moments)
5. Text 2-3 friends to do the same

**Tomorrow morning**:
1. Help record demo video
2. Review submission before sending
3. Submit by 1pm BST!

Let's ship this! 🎵
