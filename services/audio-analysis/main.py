"""
LinerNotes Audio Analysis Service
FastAPI service for real-time audio analysis using librosa

Provides:
- BPM detection from audio preview URLs
- Beat position tracking
- Audio feature extraction (RMS, spectral centroid, tempo)
- Caching for repeated requests

Based on Visualiser_Pipeline.md spec.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import librosa
import numpy as np
import requests
from typing import List, Optional
from io import BytesIO
import hashlib

app = FastAPI(title="LinerNotes Audio Analysis")

# Enable CORS for Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache (use Redis for production)
analysis_cache = {}

class AnalysisRequest(BaseModel):
    preview_url: str
    track_id: Optional[str] = None
    track_name: Optional[str] = None
    artist_name: Optional[str] = None

class AudioFeatures(BaseModel):
    rms: float
    spectral_centroid: float
    tempo: float

class AnalysisResponse(BaseModel):
    bpm: float
    beat_interval_ms: float
    first_beat_ms: float
    beats: List[float]
    audio_features: AudioFeatures
    source: str = "librosa"

@app.get("/")
def root():
    return {
        "service": "LinerNotes Audio Analysis",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_audio(request: AnalysisRequest):
    """
    Analyze audio from preview URL using librosa.

    Returns:
    - BPM (exact tempo)
    - Beat positions in milliseconds
    - First beat position (for phase alignment)
    - Audio features (RMS, spectral centroid, tempo)
    """
    try:
        # Generate cache key from preview URL
        cache_key = hashlib.md5(request.preview_url.encode()).hexdigest()

        # Check cache
        if cache_key in analysis_cache:
            print(f"[Cache HIT] {request.track_name or 'Unknown'}")
            return analysis_cache[cache_key]

        print(f"[Analyzing] {request.track_name or 'Unknown'} by {request.artist_name or 'Unknown'}")

        # Download audio from preview URL
        audio_response = requests.get(request.preview_url, timeout=10)
        if audio_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download audio preview")

        # Load audio with librosa (save to temp file for M4A support)
        import tempfile
        import os

        # Save to temp file (needed for M4A format)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.m4a') as temp_file:
            temp_file.write(audio_response.content)
            temp_path = temp_file.name

        try:
            # Load with librosa (uses ffmpeg via audioread for M4A)
            y, sr = librosa.load(temp_path, sr=22050, mono=True)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # 1. TEMPO & BEAT TRACKING
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')

        # Handle tempo as array (newer librosa) or scalar (older librosa)
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        else:
            tempo = float(tempo)

        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        # Convert to milliseconds
        beats_ms = (beat_times * 1000).tolist()

        # First beat position (for phase alignment)
        first_beat_ms = beats_ms[0] if len(beats_ms) > 0 else 0.0

        # Beat interval in milliseconds
        beat_interval_ms = (60.0 / tempo) * 1000 if tempo > 0 else 500.0

        # 2. AUDIO FEATURES
        # RMS Energy (root-mean-square)
        rms = librosa.feature.rms(y=y)[0]
        rms_mean = float(np.mean(rms))
        rms_normalized = min(1.0, rms_mean / 0.3)  # Normalize to 0-1 range

        # Spectral Centroid (brightness)
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_mean = float(np.mean(spectral_centroids))
        centroid_normalized = min(1.0, centroid_mean / 4000.0)  # Normalize to 0-1

        # Build response
        analysis = AnalysisResponse(
            bpm=float(tempo),
            beat_interval_ms=beat_interval_ms,
            first_beat_ms=first_beat_ms,
            beats=beats_ms,
            audio_features=AudioFeatures(
                rms=rms_normalized,
                spectral_centroid=centroid_normalized,
                tempo=float(tempo)
            )
        )

        # Cache result
        analysis_cache[cache_key] = analysis

        print(f"[Success] BPM: {tempo:.1f}, Beats: {len(beats_ms)}, RMS: {rms_normalized:.2f}")

        return analysis

    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch audio: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "cache_size": len(analysis_cache)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
