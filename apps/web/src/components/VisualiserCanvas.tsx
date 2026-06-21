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
 */
function applyTexture(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  texture: 'sharp' | 'soft' | 'grain' | 'glow'
) {
  switch (texture) {
    case 'grain':
      // Grainy texture (random noise)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        data[i] += noise;     // R
        data[i + 1] += noise; // G
        data[i + 2] += noise; // B
      }
      ctx.putImageData(imageData, 0, 0);
      break;

    case 'sharp':
      // Geometric patterns (lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * canvas.width / 10, 0);
        ctx.lineTo(i * canvas.width / 10, canvas.height);
        ctx.stroke();
      }
      break;

    case 'glow':
      // Soft glow overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;

    case 'soft':
    default:
      // No additional texture
      break;
  }
}

/**
 * Draw beat pulse (radial pulse synced to beatPhase).
 */
function drawBeatPulse(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { beatPhase, baseIntensity, energyMultiplier } = state;

  // Pulse radius expands/contracts with beat phase
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

  // Ease function for pulse (peaks at beatPhase = 0, fades by 0.3)
  const pulseIntensity = beatPhase < 0.3 ? 1 - (beatPhase / 0.3) : 0;
  const radius = maxRadius * (0.5 + pulseIntensity * 0.5) * energyMultiplier;
  const opacity = pulseIntensity * baseIntensity * 0.3;

  if (opacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
