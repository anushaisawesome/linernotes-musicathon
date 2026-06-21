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
 * Draw beat-synced rhythmic art piece (not just pulses).
 * Creates distinct artistic styles based on motion type.
 */
function drawBeatPulse(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: VisualState
) {
  const { beatPhase, baseIntensity, energyMultiplier, motion } = state;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Smooth easing - no snapping
  const smoothPhase = 1 - Math.pow(beatPhase, 0.5);
  const intensity = Math.max(0, smoothPhase) * baseIntensity * energyMultiplier;

  if (intensity < 0.01) return;

  ctx.save();

  // Route to artistic rendering based on motion type
  switch (motion) {
    case 'angular':
      // Fractal icicles (crystalline branching)
      drawFractalIcicles(ctx, canvas, centerX, centerY, intensity, beatPhase);
      break;

    case 'undulating':
      // Lava lamp (organic flowing blobs)
      drawLavaLamp(ctx, canvas, centerX, centerY, intensity, beatPhase);
      break;

    case 'pulse':
      // Pond ripples (expanding water circles)
      drawPondRipples(ctx, canvas, centerX, centerY, intensity, beatPhase);
      break;

    case 'drift':
      // Nebula (galaxy-like particle drift)
      drawNebula(ctx, canvas, centerX, centerY, intensity, beatPhase, energyMultiplier);
      break;
  }

  ctx.restore();
}

/**
 * Fractal icicles - crystalline branches that propagate and fade.
 * For angular/sharp genres (Trap, Metal, Electronic).
 */
function drawFractalIcicles(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  intensity: number,
  beatPhase: number
) {
  const branchCount = 8;
  const maxLength = Math.min(canvas.width, canvas.height) * 0.35 * intensity;
  const growth = 1 - beatPhase; // Grows then fades

  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2;
    const length = maxLength * growth;

    // Main icicle branch
    const endX = centerX + Math.cos(angle) * length;
    const endY = centerY + Math.sin(angle) * length;

    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.6})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Sub-branches (fractal pattern)
    if (growth > 0.3) {
      const subBranches = 3;
      for (let j = 1; j <= subBranches; j++) {
        const progress = j / (subBranches + 1);
        const subStartX = centerX + Math.cos(angle) * length * progress;
        const subStartY = centerY + Math.sin(angle) * length * progress;

        // Branch left and right
        [-1, 1].forEach(dir => {
          const subAngle = angle + (Math.PI / 6) * dir;
          const subLength = length * 0.3 * (1 - progress);
          const subEndX = subStartX + Math.cos(subAngle) * subLength;
          const subEndY = subStartY + Math.sin(subAngle) * subLength;

          ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(subStartX, subStartY);
          ctx.lineTo(subEndX, subEndY);
          ctx.stroke();
        });
      }
    }

    // Crystalline endpoint glow
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.8})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 4 * growth, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Lava lamp - organic flowing blobs that morph smoothly.
 * For undulating/soft genres (R&B, Jazz, Soul).
 */
function drawLavaLamp(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  intensity: number,
  beatPhase: number
) {
  const blobCount = 5;
  const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
  const time = Date.now() / 1000;

  for (let i = 0; i < blobCount; i++) {
    const angle = (i / blobCount) * Math.PI * 2 + time * 0.2;
    const distance = baseRadius * (1 + Math.sin(time * 0.5 + i) * 0.3);
    const blobX = centerX + Math.cos(angle) * distance * intensity;
    const blobY = centerY + Math.sin(angle) * distance * intensity;

    // Blob size pulses with beat
    const blobSize = baseRadius * (0.3 + intensity * 0.4) * (1 - beatPhase * 0.5);

    // Organic blob with gradient
    const gradient = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobSize);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.5})`);
    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${intensity * 0.2})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(blobX, blobY, blobSize, 0, Math.PI * 2);
    ctx.fill();

    // Add distortion for organic feel
    ctx.globalCompositeOperation = 'lighter';
    const distortSize = blobSize * 0.7;
    const distortX = blobX + Math.cos(time * 1.5 + i * 2) * distortSize * 0.3;
    const distortY = blobY + Math.sin(time * 1.5 + i * 2) * distortSize * 0.3;

    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.15})`;
    ctx.beginPath();
    ctx.arc(distortX, distortY, distortSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * Pond ripples - expanding concentric circles like water.
 * For pulse genres (Pop, Rock).
 */
function drawPondRipples(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  intensity: number,
  beatPhase: number
) {
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.6;
  const rippleCount = 5;

  for (let i = 0; i < rippleCount; i++) {
    const ripplePhase = (beatPhase + i * 0.15) % 1;
    const radius = maxRadius * ripplePhase;
    const opacity = intensity * (1 - ripplePhase) * 0.4;

    if (opacity > 0.01) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.lineWidth = 2 + (1 - ripplePhase) * 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Central splash
  const splashSize = 15 * (1 - beatPhase) * intensity;
  if (splashSize > 1) {
    const splash = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, splashSize);
    splash.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
    splash.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = splash;
    ctx.beginPath();
    ctx.arc(centerX, centerY, splashSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Nebula - galaxy-like particle clouds that drift and swirl.
 * For drift genres (Ambient, Electronic).
 */
function drawNebula(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  intensity: number,
  beatPhase: number,
  energyMultiplier: number
) {
  const particleCount = Math.floor(30 * energyMultiplier);
  const time = Date.now() / 1000;
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + time * 0.1;
    const spiral = (i / particleCount) * 3;
    const distance = maxRadius * (0.3 + spiral * 0.2) * intensity;

    const x = centerX + Math.cos(angle + spiral) * distance;
    const y = centerY + Math.sin(angle + spiral) * distance;

    // Particle size varies
    const size = (2 + Math.sin(time * 2 + i) * 2) * (1 - beatPhase * 0.3);
    const opacity = intensity * (0.3 + Math.sin(time + i) * 0.2);

    // Glowing particle
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
    glow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, Math.PI * 2);
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
