#!/bin/bash
# Test script for audio analysis service

echo "Testing Audio Analysis Service..."
echo ""

# Test 1: Health Check
echo "1. Health Check:"
curl -s http://localhost:8001/health | python -m json.tool
echo ""

# Test 2: Analyze with real iTunes preview (Travis Scott - SICKO MODE)
echo "2. Analyzing SICKO MODE (Travis Scott)..."
curl -s -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/1e/39/87/1e398743-68ec-7f8c-fb60-c9d98db3df17/mzaf_3042058854393542925.plus.aac.p.m4a",
    "track_name": "SICKO MODE",
    "artist_name": "Travis Scott"
  }' | python -m json.tool
echo ""

echo "Tests complete!"
