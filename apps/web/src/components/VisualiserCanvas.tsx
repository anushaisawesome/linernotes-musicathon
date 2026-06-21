/**
 * Visualiser Canvas Component
 *
 * Canvas-based renderer that consumes VisualState and draws visuals at 60fps.
 * Simpler and more performant than p5.js for this use case.
 *
 * Renders:
 * - Base aesthetic (palette gradients, texture overlays, motion styles)
 * - Beat pulse (sync with BPM)
 * - Lyric accents (color shifts, particle effects, directional movement)
 * - Moment override (visual surge when favourite-bit fires)
 *
 * Based on Visualiser_Pipeline.md spec.
 */

'use client';

import { useEffect, useRef } from 'react';
import type { VisualState } from '@/lib/visualiser-types';

interface VisualiserCanvasProps {
  visualState: VisualState;
  width: number;
  height: number;
  className?: string;
}

export function VisualiserCanvas({ visualState, width, height, className }: VisualiserCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Animation loop
    function render() {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ──────────────────────────────────────────────────────────────────────
      // Layer 1: Base Gradient (from palette)
      // ──────────────────────────────────────────────────────────────────────
      drawBaseGradient(ctx, canvas, visualState);

      // ──────────────────────────────────────────────────────────────────────
      // Layer 2: Beat Pulse (radial pulse from center)
      // ──────────────────────────────────────────────────────────────────────
      if (visualState.beatPhase !== undefined) {
        drawBeatPulse(ctx, canvas, visualState);
      }

      // ──────────────────────────────────────────────────────────────────────
      // Layer 3: Lyric Accent Effects
      // ──────────────────────────────────────────────────────────────────────
      if (visualState.accentColour) {
        drawAccentColor(ctx, canvas, visualState);
      }

      if (visualState.effect) {
        drawEffect(ctx, canvas, visualState);
      }

      // ──────────────────────────────────────────────────────────────────────
      // Layer 4: Moment Override (surge effect)
      // ──────────────────────────────────────────────────────────────────────
      if (visualState.momentOverride) {
        drawMomentSurge(ctx, canvas, visualState);
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(render);
    }

    // Start render loop
    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [visualState, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  );
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Draw base gradient from palette.
 */
function drawBaseGradient(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { palette, texture, motion } = state;

  // Create radial gradient
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.max(canvas.width, canvas.height) * 0.8;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

  // Add color stops from palette
  palette.forEach((color, i) => {
    const stop = i / (palette.length - 1);
    gradient.addColorStop(stop, color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply texture overlay
  applyTexture(ctx, canvas, texture);
}

/**
 * Apply texture overlay based on texture type.
 * Enhanced to be more visible and genre-specific.
 */
function applyTexture(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  texture: 'sharp' | 'soft' | 'grain' | 'glow'
) {
  switch (texture) {
    case 'grain':
      // Grainy film texture (Folk, Indie, Lo-fi)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 50; // Increased from 30
        data[i] += noise;     // R
        data[i + 1] += noise; // G
        data[i + 2] += noise; // B
      }
      ctx.putImageData(imageData, 0, 0);
      break;

    case 'sharp':
      // Hard geometric grid (Trap, Metal, Electronic)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; // Increased from 0.05
      ctx.lineWidth = 2;

      // Vertical lines
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(i * canvas.width / 15, 0);
        ctx.lineTo(i * canvas.width / 15, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * canvas.height / 15);
        ctx.lineTo(canvas.width, i * canvas.height / 15);
        ctx.stroke();
      }

      ctx.restore();
      break;

    case 'glow':
      // Soft luminous glow (Pop, Dance)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxDim = Math.max(canvas.width, canvas.height);

      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxDim * 0.6
      );
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;

    case 'soft':
      // Subtle vignette (R&B, Jazz, Soul)
      const vignetteCenterX = canvas.width / 2;
      const vignetteCenterY = canvas.height / 2;
      const vignetteRadius = Math.max(canvas.width, canvas.height) * 0.7;

      const vignetteGradient = ctx.createRadialGradient(
        vignetteCenterX, vignetteCenterY, vignetteRadius * 0.3,
        vignetteCenterX, vignetteCenterY, vignetteRadius
      );
      vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');

      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
  }
}

/**
 * Draw beat pulse (genre-appropriate pulse synced to beatPhase).
 * Pulse style varies based on texture (sharp vs soft) and motion type.
 */
function drawBeatPulse(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { beatPhase, baseIntensity, energyMultiplier, texture, motion } = state;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

  // ──────────────────────────────────────────────────────────────────────
  // TEXTURE-BASED TIMING (sharp vs soft)
  // ──────────────────────────────────────────────────────────────────────
  let pulseDuration = 0.3; // default
  let baseOpacity = 0.3;   // default

  switch (texture) {
    case 'sharp':
      // Fast, aggressive pulse (Trap, Metal, Electronic)
      pulseDuration = 0.2;
      baseOpacity = 0.5;
      break;
    case 'soft':
      // Slow, smooth fade (R&B, Jazz, Ambient)
      pulseDuration = 0.6;
      baseOpacity = 0.15;
      break;
    case 'glow':
      // Medium, glowing pulse (Pop, Dance)
      pulseDuration = 0.4;
      baseOpacity = 0.25;
      break;
    case 'grain':
      // Subtle, textured pulse (Folk, Indie)
      pulseDuration = 0.5;
      baseOpacity = 0.2;
      break;
  }

  // Ease function for pulse (peaks at beatPhase = 0, fades by pulseDuration)
  const pulseIntensity = beatPhase < pulseDuration
    ? 1 - (beatPhase / pulseDuration)
    : 0;

  const radius = maxRadius * (0.5 + pulseIntensity * 0.5) * energyMultiplier;
  const opacity = pulseIntensity * baseIntensity * baseOpacity;

  if (opacity < 0.01) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // ──────────────────────────────────────────────────────────────────────
  // MOTION-BASED RENDERING (angular vs undulating vs pulse vs drift)
  // ──────────────────────────────────────────────────────────────────────
  switch (motion) {
    case 'angular':
      // Geometric shapes (rectangles/diamonds) for hard-hitting tracks
      drawAngularPulse(ctx, centerX, centerY, radius, texture);
      break;

    case 'undulating':
      // Multiple expanding wave rings (organic, flowing)
      drawUndulatingPulse(ctx, centerX, centerY, radius, pulseIntensity);
      break;

    case 'drift':
      // Floating particles instead of centered pulse
      drawDriftParticles(ctx, canvas, radius, pulseIntensity, energyMultiplier);
      break;

    case 'pulse':
    default:
      // Standard radial pulse (classic circle)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}

/**
 * Draw angular geometric pulse (for sharp, aggressive genres).
 */
function drawAngularPulse(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  texture: 'sharp' | 'soft' | 'grain' | 'glow'
) {
  ctx.fillStyle = texture === 'sharp'
    ? 'rgba(255, 255, 255, 0.9)'
    : 'rgba(255, 255, 255, 0.6)';

  // Draw rotated diamond/square
  const size = radius * 1.2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.PI / 4); // 45-degree rotation
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

/**
 * Draw undulating wave rings (for smooth, flowing genres).
 */
function drawUndulatingPulse(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  intensity: number
) {
  // Draw 3 expanding rings with offset
  for (let i = 0; i < 3; i++) {
    const offset = i * 0.15;
    const ringIntensity = Math.max(0, intensity - offset);
    if (ringIntensity <= 0) continue;

    const ringRadius = radius * (0.7 + i * 0.15);
    const ringOpacity = ringIntensity * 0.3;

    ctx.globalAlpha = ringOpacity;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draw drifting particles (for ambient, spacey genres).
 */
function drawDriftParticles(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  baseRadius: number,
  intensity: number,
  energyMultiplier: number
) {
  const particleCount = Math.floor(8 * energyMultiplier);

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const distance = baseRadius * (0.5 + intensity * 0.5);
    const x = canvas.width / 2 + Math.cos(angle) * distance;
    const y = canvas.height / 2 + Math.sin(angle) * distance;
    const size = 4 + intensity * 6;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw accent color overlay (from color words in lyrics).
 */
function drawAccentColor(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { accentColour, energyMultiplier } = state;

  if (!accentColour) return;

  const opacity = Math.min(0.4, 0.2 * energyMultiplier);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = accentColour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/**
 * Draw particle effect (rain, fire, frost, bloom, flash).
 */
function drawEffect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { effect, density, energyMultiplier } = state;

  if (!effect) return;

  const particleCount = Math.floor(density * 50 * energyMultiplier);

  ctx.save();

  switch (effect) {
    case 'rain':
      drawRain(ctx, canvas, particleCount);
      break;
    case 'fire':
      drawFire(ctx, canvas, particleCount);
      break;
    case 'frost':
      drawFrost(ctx, canvas, particleCount);
      break;
    case 'bloom':
      drawBloom(ctx, canvas, particleCount);
      break;
    case 'flash':
      drawFlash(ctx, canvas);
      break;
  }

  ctx.restore();
}

/**
 * Rain particles (vertical droplets).
 */
function drawRain(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, count: number) {
  ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
  ctx.lineWidth = 1;

  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = 10 + Math.random() * 20;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }
}

/**
 * Fire particles (rising embers).
 */
function drawFire(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, count: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = canvas.height - Math.random() * canvas.height * 0.6;
    const size = 2 + Math.random() * 4;

    ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 50, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Frost particles (crystalline sparkles).
 */
function drawFrost(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, count: number) {
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)';
  ctx.lineWidth = 1;

  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 3 + Math.random() * 5;

    // Draw simple + shape for crystals
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  }
}

/**
 * Bloom particles (soft glowing circles).
 */
function drawBloom(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, count: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 5 + Math.random() * 15;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Flash effect (screen flash).
 */
function drawFlash(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw moment surge (radial burst when favourite-bit fires).
 */
function drawMomentSurge(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.max(canvas.width, canvas.height) * 0.7;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
  gradient.addColorStop(0, state.accentColour || 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
