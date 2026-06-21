# Visualiser Implementation Guide

## 📦 What's Been Built

I've implemented the complete visualiser pipeline from `Visualiser_Pipeline.md` with all 4 layers:

### Core Files Created

1. **`src/lib/visualiser-types.ts`**
   - Complete TypeScript types for VisualState, BaseAesthetic, RhythmData, LyricAccent
   - Type-safe interfaces for all visualiser components

2. **`src/lib/visualiser-lexicons.ts`**
   - Curated keyword→effect mappings for lyric analysis
   - COLOR_LEXICON: 30+ color words → hex colors ("blue" → #4287f5)
   - ENERGY_HIGH/LOW: Ad-libs, imperatives, melancholy markers
   - WEATHER_LEXICON: rain, fire, frost, bloom, flash effects
   - MOTION: up/down/fast directional movement
   - Helper functions: `findColorInText()`, `findWeatherInText()`, etc.

3. **`src/lib/visualiser-accent-analyzer.ts`**
   - Real-time lyric line analyzer (runtime only, never persisted)
   - Extracts visual effects from currently-playing line
   - Handles: color words, energy markers, weather effects, motion verbs, density
   - ALL CAPS / punctuation sensitivity
   - Syllable density calculation

4. **`src/lib/visualiser-base-aesthetic.ts`**
   - Genre → visual preset mapping (14 genre presets)
   - Audio features integration (RMS energy, spectral centroid, tempo)
   - Palette temperature shifts (warm/cool adjustments)
   - Optional Last.fm tag enrichment ("melancholic", "energetic", "chill")
   - Persistent, survives Musixmatch key expiry

5. **`src/lib/visualiser-engine.ts`**
   - Main orchestrator: merges all 4 layers → single VisualState
   - `VisualiserEngine` class with `getVisualState()` called at 60fps
   - `PositionPredictor` for smooth 5Hz→60fps interpolation
   - Beat phase calculator
   - Mock rhythm generator for testing

6. **`src/components/VisualiserCanvas.tsx`**
   - Canvas-based renderer (60fps)
   - Renders: base gradients, beat pulses, lyric accents, moment surges
   - Particle effects: rain, fire, frost, bloom, flash
   - Texture overlays: sharp, soft, grain, glow
   - Accent color blending
   - Moment override radial burst

---

## 🎯 The 4 Layers

### Layer 1: Base Aesthetic (Persistent)
- **Source**: iTunes genre + librosa audio features
- **Output**: palette (5 colors), texture, motion style
- **Examples**:
  - Trap → icy/sharp/angular
  - R&B → warm/soft/undulating
- **Survives**: Musixmatch key expiry ✅

### Layer 2: Rhythm (Persistent)
- **Source**: Beat tracking from librosa
- **Output**: BPM, beat phase (0-1), beat positions
- **Requires**: `firstBeatMs` hand-tuned per track for phase alignment
- **Survives**: Key expiry ✅

### Layer 3: Lyric Accents (Real-time, Runtime Only)
- **Source**: Currently-playing Musixmatch lyric line
- **Output**:
  - accentColour (from color words)
  - energyMultiplier (0.5-2.0, from ad-libs/ALL CAPS)
  - effect (rain/fire/frost/bloom/flash)
  - direction (up/down/fast)
  - density (syllable speed)
- **Compliance**: NEVER PERSISTED (fetched live, in-memory only)

### Layer 4: Moment Override (Persistent)
- **Source**: User's favourite-bit moments from DB
- **Output**: Visual surge when playhead crosses moment marker
- **Your data**: Safe to persist ✅

---

## 🔌 Integration Steps

### 1. Add Visualiser to Experience Player

In `/apps/web/app/experience/[id]/page.tsx`:

```typescript
import { VisualiserEngine, PositionPredictor, createMockRhythm } from '@/lib/visualiser-engine';
import { deriveBaseAesthetic } from '@/lib/visualiser-base-aesthetic';
import { VisualiserCanvas } from '@/components/VisualiserCanvas';
import type { VisualState } from '@/lib/visualiser-types';

// Inside ExperienceContent component:
const [visualState, setVisualState] = useState<VisualState | null>(null);
const engineRef = useRef<VisualiserEngine | null>(null);
const predictorRef = useRef<PositionPredictor>(new PositionPredictor());

// Initialize engine when track loads
useEffect(() => {
  if (!review?.track) return;

  // Derive base aesthetic from genre (or default)
  const genre = review.track.genre || 'default';
  const baseAesthetic = deriveBaseAesthetic(genre);

  // Create mock rhythm (replace with real librosa data later)
  const rhythm = createMockRhythm(120); // 120 BPM default

  // Initialize engine
  engineRef.current = new VisualiserEngine(baseAesthetic, rhythm);
}, [review]);

// 60fps rendering loop
useEffect(() => {
  let animationFrameId: number;

  function renderLoop() {
    if (!engineRef.current || !playerState) {
      animationFrameId = requestAnimationFrame(renderLoop);
      return;
    }

    // Update predictor at 5Hz (handled elsewhere)
    const predictedPos = predictorRef.current.predict();

    // Get current lyric line text
    const currentLine = annotations?.activeLine?.text || '';

    // Check if moment is active
    const momentActive = !!activeMoment;

    // Get visual state
    const state = engineRef.current.getVisualState(
      predictedPos,
      playerState.isPlaying,
      currentLine,
      momentActive
    );

    setVisualState(state);

    animationFrameId = requestAnimationFrame(renderLoop);
  }

  renderLoop();

  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}, [playerState, annotations, activeMoment]);

// Add canvas to render tree (behind lyrics)
return (
  <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
    {/* Existing immersive background */}
    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      {/* ... existing gradients ... */}
    </div>

    {/* NEW: Visualiser Canvas (between background and content) */}
    {visualState && (
      <VisualiserCanvas
        visualState={visualState}
        width={1920}
        height={1080}
        className="visualiser-layer"
      />
    )}

    {/* Existing content (lyrics, controls, etc.) */}
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* ... rest of experience UI ... */}
    </div>
  </main>
);
```

### 2. Add 5Hz Position Poll

```typescript
// Poll player state at 5Hz to update predictor
useEffect(() => {
  if (!player || !playerState?.isPlaying) return;

  const interval = setInterval(async () => {
    const currentState = await player.getCurrentState();
    if (currentState) {
      setPlayerState(currentState);
      predictorRef.current.update(currentState.positionMs, currentState.isPlaying);
    }
  }, 200); // 5Hz

  return () => clearInterval(interval);
}, [player, playerState?.isPlaying]);
```

### 3. Add Rhythm Data (Future: Librosa API)

For now, use mock rhythm. Later, call your Python/FastAPI service:

```typescript
// Future: Fetch real beat-tracked rhythm data
async function fetchRhythmData(trackId: string) {
  const res = await fetch(`/api/audio-analysis/${trackId}`);
  const data = await res.json();
  return {
    bpm: data.bpm,
    beatIntervalMs: data.beatIntervalMs,
    firstBeatMs: data.firstBeatMs, // Hand-tuned
    beats: data.beats,
  };
}
```

### 4. Toggle Visualiser On/Off

Add a control button:

```typescript
const [visualiserEnabled, setVisualiserEnabled] = useState(true);

<button onClick={() => setVisualiserEnabled(!visualiserEnabled)}>
  {visualiserEnabled ? 'Hide Visualiser' : 'Show Visualiser'}
</button>

{visualiserEnabled && visualState && (
  <VisualiserCanvas ... />
)}
```

---

## 🎨 Customization

### Adjust Visuals

**Intensity**: Edit opacity in `VisualiserCanvas.tsx` (lines 204, 227, 248)
**Particle Count**: Adjust `particleCount` calculation (line 239)
**Beat Pulse Size**: Modify `maxRadius` (line 171)

### Add More Genre Presets

Edit `GENRE_PRESETS` in `visualiser-base-aesthetic.ts`:

```typescript
'Afrobeats': {
  palette: ['#1a1a1a', '#f59342', '#f5e042', '#42f554', '#4287f5'],
  texture: 'sharp',
  motion: 'pulse',
},
```

### Add More Color Words

Edit `COLOR_LEXICON` in `visualiser-lexicons.ts`:

```typescript
'cyan': '#00ffff',
'magenta': '#ff00ff',
```

---

## 🚨 Compliance Reminders

1. **Lyric accents are RUNTIME ONLY** - never persist to DB/disk/localStorage
2. **For post-expiry preview**: Use mock lyrics YOU WRITE (not real Musixmatch lyrics)
3. **Base aesthetic + rhythm ARE safe to persist** (not Musixmatch-derived)

---

## 📹 Demo Tracks

For camera-ready demo, hand-tune these per track:
1. **firstBeatMs** - Sync beat phase to actual track (eyeball against playback)
2. **Lexicons** - Add track-specific keywords to lexicons if needed
3. **Genre** - Ensure correct iTunes genre in track metadata

---

## 🔧 Next Steps

- [ ] **Integrate into Experience player** (follow steps above)
- [ ] **Test with real Spotify playback** (check beat sync)
- [ ] **Add librosa beat tracking API** (Python/FastAPI service)
- [ ] **Hand-tune `firstBeatMs` for demo tracks** (3-4 tracks)
- [ ] **Record video with visualiser active** (before key expiry)
- [ ] **Create mock lyrics for post-expiry preview** (your own text, bake freely)

---

## 🎬 What It Looks Like

- **Base layer**: Radial gradients using album palette colors
- **Beat pulse**: White radial flash on each beat (0.3s fade)
- **Lyric "blue"**: Screen tints blue (#4287f5) while line plays
- **Lyric "fire"**: Orange/red embers rise from bottom
- **Lyric "LET'S GO!"**: Energy multiplier → bigger pulse + more particles
- **Moment fires**: Radial burst effect (gold/accent color)

---

Built to spec from `Visualiser_Pipeline.md` ✨
Ready to ship to Musicathon judges 🎉
