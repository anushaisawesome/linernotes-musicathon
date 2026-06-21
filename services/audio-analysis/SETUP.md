# Audio Analysis Service Setup Guide

Complete setup guide for the librosa-based audio analysis service.

## Quick Start (Local Development)

### 1. Install Python Dependencies

```bash
cd services/audio-analysis

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 2. Start the Service

```bash
python main.py
# Server runs on http://localhost:8001
```

### 3. Test It

```bash
# Run test script
./test.sh

# Or manually
curl http://localhost:8001/health
```

### 4. Connect to Next.js

Add to `/apps/web/.env.local`:
```bash
AUDIO_ANALYSIS_SERVICE_URL=http://localhost:8001
```

Restart Next.js dev server:
```bash
cd ../../apps/web
npm run dev
```

Now the Experience player will use REAL beat tracking! 🎉

---

## Docker Setup (Recommended for Production)

### Build Image

```bash
cd services/audio-analysis
docker build -t linernotes-audio-analysis .
```

### Run Container

```bash
docker run -p 8001:8001 linernotes-audio-analysis
```

### Docker Compose (Full Stack)

Create `docker-compose.yml` in repo root:

```yaml
version: '3.8'

services:
  audio-analysis:
    build: ./services/audio-analysis
    ports:
      - "8001:8001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      - AUDIO_ANALYSIS_SERVICE_URL=http://audio-analysis:8001
    depends_on:
      - audio-analysis
```

Run:
```bash
docker-compose up
```

---

## Production Deployment

### Option 1: Railway (Easiest)

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
railway login
```

2. **Deploy:**
```bash
cd services/audio-analysis
railway init
railway up
```

3. **Get URL:**
```bash
railway domain
# Copy the URL (e.g., https://linernotes-audio-analysis-production.up.railway.app)
```

4. **Add to Vercel:**
Go to Vercel → Settings → Environment Variables:
```
AUDIO_ANALYSIS_SERVICE_URL=https://linernotes-audio-analysis-production.up.railway.app
```

5. **Redeploy Next.js:**
```bash
git push origin main
```

### Option 2: Render

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Settings:
   - **Name**: linernotes-audio-analysis
   - **Root Directory**: services/audio-analysis
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Create → Copy service URL
6. Add to Vercel env vars

### Option 3: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
cd services/audio-analysis
fly launch
fly deploy
```

---

## Environment Variables

### Development (.env.local in /apps/web/)
```bash
AUDIO_ANALYSIS_SERVICE_URL=http://localhost:8001
```

### Production (Vercel Settings)
```bash
AUDIO_ANALYSIS_SERVICE_URL=https://your-service.railway.app
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process
lsof -i :8001

# Kill it
kill -9 <PID>
```

### librosa Import Error
```bash
pip install --upgrade librosa soundfile
```

### SSL Certificate Error
```bash
pip install --upgrade certifi requests
```

### Docker Build Fails
```bash
# Clean build
docker build --no-cache -t linernotes-audio-analysis .
```

### Python Service Not Responding
```bash
# Check logs
docker logs <container-id>

# Or Railway logs
railway logs
```

---

## Testing End-to-End

1. **Start Python service** (local or deployed)
2. **Start Next.js** with `AUDIO_ANALYSIS_SERVICE_URL` set
3. **Open Experience player** with a track
4. **Check console logs**:
   - ✅ `[audio-analysis] ✅ Python service success: 155.3 BPM`
   - ❌ `[audio-analysis] Python service unavailable, using fallback`

5. **Verify visuals**:
   - Beat pulses should be perfectly synced
   - BPM should be exact (not genre average)
   - Console shows `source: "librosa"` not `"genre-heuristic-fallback"`

---

## Performance

**Local (localhost:8001):**
- Download preview: ~300ms
- Librosa analysis: ~2s
- Total: ~2-3s

**Production (Railway/Render):**
- Cold start: ~5-10s (first request)
- Warm: ~2-3s
- Cached: <10ms

**Optimization:**
- Add Redis for persistent cache
- Use CDN for preview URLs
- Precompute popular tracks

---

## What Gets Analyzed

**From iTunes Preview URL (30s clip):**
- Exact BPM (not genre average!)
- Beat positions in milliseconds
- First beat position (for phase sync)
- RMS energy (real, not heuristic)
- Spectral centroid (real brightness)

**Stored in Response:**
```json
{
  "bpm": 155.3,                    // Exact from librosa
  "beat_interval_ms": 386.5,
  "first_beat_ms": 234.0,          // For phase alignment
  "beats": [234, 620, 1007, ...],  // All beat positions
  "audio_features": {
    "rms": 0.73,                   // Real energy
    "spectral_centroid": 0.68,     // Real brightness
    "tempo": 155.3
  },
  "genre": "Hip-Hop/Rap",          // From iTunes
  "source": "librosa"              // Not "genre-heuristic-fallback"
}
```

---

## Next Steps

1. ✅ Local testing
2. ✅ Railway deployment
3. ✅ Vercel environment variable
4. ✅ End-to-end test with real track
5. 🎬 Record demo with perfect beat sync!

---

Built with librosa + FastAPI 🎵
Perfect beat tracking for Musicathon 🎉
