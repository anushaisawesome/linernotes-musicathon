# LinerNotes Audio Analysis Service

FastAPI service for real-time audio analysis using librosa.

## Features

- **BPM Detection**: Extract exact tempo from audio
- **Beat Tracking**: Precise beat positions in milliseconds
- **Audio Features**: RMS energy, spectral centroid
- **Caching**: In-memory cache for repeated requests
- **Fast**: Analyzes 30s preview in ~2-3 seconds

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or use conda
conda create -n audio-analysis python=3.11
conda activate audio-analysis
pip install -r requirements.txt
```

## Usage

### Start Server

```bash
python main.py
# Server runs on http://localhost:8001
```

### API Endpoints

**POST /analyze**

Analyze audio from preview URL:

```bash
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "preview_url": "https://audio-ssl.itunes.apple.com/...",
    "track_name": "SICKO MODE",
    "artist_name": "Travis Scott"
  }'
```

Response:
```json
{
  "bpm": 155.3,
  "beat_interval_ms": 386.5,
  "first_beat_ms": 234.0,
  "beats": [234.0, 620.5, 1007.0, ...],
  "audio_features": {
    "rms": 0.73,
    "spectral_centroid": 0.68,
    "tempo": 155.3
  },
  "source": "librosa"
}
```

**GET /health**

Health check:
```bash
curl http://localhost:8001/health
```

## Integration with Next.js

Update `/api/audio-analysis/route.ts`:

```typescript
// Try Python service first, fallback to genre heuristic
const pythonServiceUrl = process.env.AUDIO_ANALYSIS_SERVICE_URL || 'http://localhost:8001';

try {
  const response = await fetch(`${pythonServiceUrl}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preview_url: itunesData.previewUrl,
      track_name: trackName,
      artist_name: artistName
    })
  });

  if (response.ok) {
    const data = await response.json();
    return NextResponse.json(data);
  }
} catch (error) {
  console.warn('Python service unavailable, using genre heuristic');
}

// Fallback to genre-based estimation...
```

## Environment Variables

```bash
# .env.local
AUDIO_ANALYSIS_SERVICE_URL=http://localhost:8001
```

## Production Deployment

### Option 1: Railway
```bash
railway init
railway up
```

### Option 2: Render
1. Connect GitHub repo
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Option 3: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

## Performance

- Preview download: ~300ms
- Librosa analysis: ~2s
- Total: ~2-3s per track
- Cached: <10ms

## Caching

Currently uses in-memory cache. For production:

```python
import redis
redis_client = redis.Redis(host='localhost', port=6379)
```

## Testing

```bash
# Test with real iTunes preview
python -c "
import requests
response = requests.post('http://localhost:8001/analyze', json={
    'preview_url': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/...',
    'track_name': 'Test Track',
    'artist_name': 'Test Artist'
})
print(response.json())
"
```

## Troubleshooting

**Import Error: No module named 'librosa'**
```bash
pip install librosa soundfile
```

**SSL Certificate Error**
```bash
pip install --upgrade certifi
```

**Port Already in Use**
```bash
lsof -i :8001
kill -9 <PID>
```

---

Built with librosa 🎵
Ready for Musicathon 🎉
