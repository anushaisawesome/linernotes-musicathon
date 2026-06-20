# LinerNotes Musicathon Demo Checklist

## Demo Video Requirements
- **Length**: ≤5 minutes
- **Focus**: 60% on Experience feature (timestamped notes)
- **Due**: Monday June 22, 12:00 UTC

## Features to Demonstrate

### 1. Core Experience Feature (60% of video)
- [ ] Create a review with multiple timestamped moments
- [ ] Show timestamp notch UI (gold HERO element)
- [ ] Navigate between moments on the Experience page
- [ ] Demonstrate how timestamps link to specific parts of tracks
- [ ] Show the 9:16 Instagram-story card design

### 2. Review Creation Flow (20% of video)
- [ ] Search for an album/track
- [ ] Add star rating
- [ ] Write main review text
- [ ] Add timestamped notes (at least 3)
- [ ] Show the composer interface

### 3. Social Features (10% of video)
- [ ] Show feed of reviews
- [ ] Demonstrate following/followers
- [ ] Show profile page with reviews

### 4. Music Service Integration (10% of video)
- [ ] Show Last.fm connection working
- [ ] Demonstrate Last.fm prompts ("worth a note")
- [ ] Show Spotify connection

## Testing Checklist

### Authentication & Onboarding
- [x] Spotify OAuth sign-in works
- [x] Email/password sign-up works
- [x] Onboarding flow for new users
- [x] Profile setup (handle, display name)

### Last.fm Integration
- [x] Last.fm connection works
- [x] Last.fm prompts display correctly
- [x] Artwork fetching (with fallback)
- [x] Metadata extraction (artist, track, album)
- [ ] Prompts populate the composer correctly

### Review Creation
- [ ] Album search works
- [ ] Track search works
- [ ] Star rating selection
- [ ] Main review text input
- [ ] Add timestamped moments
- [ ] Format timestamps (m:ss)
- [ ] Save review to database

### Experience Page
- [ ] Navigate to Experience from review
- [ ] View all moments with timestamps
- [ ] Click timestamps to navigate
- [ ] See full review context
- [ ] Instagram-story card design renders correctly

### Feed & Social
- [ ] Reviews appear in feed
- [ ] Profile pages display reviews
- [ ] Follow/unfollow functionality
- [ ] User handles link correctly

## Content to Create for Demo

### Suggested Albums/Tracks
Create reviews with meaningful timestamped notes for:
1. **Album review** - Show multiple favorite moments across different tracks
2. **Track review** - Deep dive with 3-5 specific timestamps
3. **Last.fm prompt** - Use a prompt to create a quick review

### Example Timestamped Notes
- "0:45 - that bass drop is insane"
- "2:14 - the way the vocals layer here"
- "1:32 - this chord progression gives me chills"
- "3:20 - unexpected key change"

## Demo Script Outline

1. **Intro (15 seconds)**
   - "This is LinerNotes - capture your listening moments"
   - Show main feed

2. **Last.fm Integration (30 seconds)**
   - "Connect your Last.fm to get personalized prompts"
   - Show prompts based on listening history
   - Click a prompt to start a review

3. **Creating a Review with Timestamps (2 minutes)**
   - Search for album/track
   - Add star rating
   - Write main thoughts
   - **Add multiple timestamped moments** (THIS IS THE FOCUS)
   - Show the timestamp UI clearly
   - Save the review

4. **The Experience (1.5 minutes)**
   - Navigate to the Experience page
   - Show how moments are displayed with timestamps
   - Click through different moments
   - Highlight the gold timestamp notch design
   - Show the Instagram-story card layout

5. **Social Features (45 seconds)**
   - View the review in feed
   - Visit profile
   - Show following/followers

6. **Outro (15 seconds)**
   - "LinerNotes - remember what moved you"
   - Call to action

## Technical Notes

- Use production URL: https://linernotes-musicathon.vercel.app
- Test on latest Chrome/Safari
- Clear cache if needed
- Have test account ready with:
  - Connected Last.fm
  - Some existing reviews
  - A few followers

## Post-Demo Tasks
- [ ] Export video (≤5 minutes)
- [ ] Add captions if needed
- [ ] Upload to submission platform
- [ ] Submit before deadline (June 22, 12:00 UTC)
