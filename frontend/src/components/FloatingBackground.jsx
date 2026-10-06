import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../context/ThemeContext';

// Inline SVGs for trust symbols
function ShieldShape({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}

function KeyShape({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="m21 2-9.6 9.6"/>
      <path d="m15.5 7.5 3 3L22 7l-3-3"/>
    </svg>
  );
}

function LockShape({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function QrGlyphShape({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="5" height="5" x="3" y="3" rx="1"/>
      <rect width="5" height="5" x="16" y="3" rx="1"/>
      <rect width="5" height="5" x="3" y="16" rx="1"/>
      <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
      <path d="M21 21v.01"/>
      <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
      <path d="M3 12h.01"/>
      <path d="M12 3h.01"/>
      <path d="M12 16v.01"/>
      <path d="M16 12h1"/>
      <path d="M21 12v.01"/>
      <path d="M12 21v-1"/>
    </svg>
  );
}

// 24 Shapes categorized across 3 layered depths
const SHAPES_CONFIG = [
  // Layer 1: Deep ambient glowing light orbs
  { id: 1, layer: 1, type: 'orb', color: 'var(--accent-indigo)', size: 320, top: '-5%', left: '70%', blur: 60, opacity: 0.14, dx: 45, dy: 35, dur: 18000, delay: 0 },
  { id: 2, layer: 1, type: 'orb', color: 'var(--accent-cyan)', size: 280, top: '45%', left: '-8%', blur: 55, opacity: 0.12, dx: -35, dy: 50, dur: 20000, delay: 1000 },
  { id: 3, layer: 1, type: 'orb', color: 'var(--emerald-primary)', size: 260, top: '75%', left: '60%', blur: 50, opacity: 0.11, dx: 40, dy: -40, dur: 22000, delay: 2000 },

  // Layer 2: Midground geometric icons & outlines
  { id: 4, layer: 2, type: 'shield', color: 'var(--emerald-primary)', size: 36, top: '18%', left: '84%', blur: 0, opacity: 0.24, dx: -35, dy: 25, dur: 11000, delay: 300 },
  { id: 5, layer: 2, type: 'key', color: 'var(--accent-cyan)', size: 30, top: '14%', left: '42%', blur: 0, opacity: 0.22, dx: 25, dy: -30, dur: 10000, delay: 800 },
  { id: 6, layer: 2, type: 'lock', color: 'var(--amber-primary)', size: 28, top: '82%', left: '32%', blur: 0, opacity: 0.22, dx: -20, dy: -35, dur: 12000, delay: 500 },
  { id: 7, layer: 2, type: 'qr', color: 'var(--accent-indigo)', size: 34, top: '44%', left: '92%', blur: 0, opacity: 0.2, dx: -30, dy: 30, dur: 13000, delay: 1200 },
  { id: 8, layer: 2, type: 'shield', color: 'var(--accent-indigo)', size: 32, top: '62%', left: '48%', blur: 0, opacity: 0.18, dx: 25, dy: 20, dur: 11500, delay: 700 },
  { id: 9, layer: 2, type: 'key', color: 'var(--accent-indigo)', size: 28, top: '3%', left: '65%', blur: 0, opacity: 0.22, dx: -30, dy: 20, dur: 9800, delay: 200 },
  { id: 10, layer: 2, type: 'lock', color: 'var(--emerald-primary)', size: 26, top: '90%', left: '64%', blur: 0, opacity: 0.2, dx: 20, dy: -25, dur: 12500, delay: 900 },
  { id: 11, layer: 2, type: 'qr', color: 'var(--emerald-primary)', size: 30, top: '86%', left: '16%', blur: 0, opacity: 0.18, dx: 30, dy: -20, dur: 10500, delay: 600 },

  // Layer 3: Foreground crisp shapes, rings, and rounded nodes
  { id: 12, layer: 3, type: 'circle', color: 'var(--accent-indigo)', size: 44, top: '10%', left: '8%', blur: 1, opacity: 0.2, dx: 30, dy: -35, dur: 8500, delay: 0 },
  { id: 13, layer: 3, type: 'rounded-square', color: 'var(--accent-cyan)', size: 38, top: '60%', left: '12%', blur: 1, opacity: 0.18, dx: 25, dy: 40, dur: 9500, delay: 1100 },
  { id: 14, layer: 3, type: 'ring', color: 'var(--accent-indigo)', size: 52, top: '74%', left: '78%', blur: 1, opacity: 0.22, dx: -30, dy: -30, dur: 11000, delay: 1400 },
  { id: 15, layer: 3, type: 'circle', color: 'var(--emerald-primary)', size: 26, top: '38%', left: '5%', blur: 0, opacity: 0.24, dx: 35, dy: 25, dur: 8200, delay: 400 },
  { id: 16, layer: 3, type: 'rounded-square', color: 'var(--accent-indigo)', size: 32, top: '30%', left: '72%', blur: 1, opacity: 0.16, dx: -25, dy: -25, dur: 10800, delay: 1300 },
  { id: 17, layer: 3, type: 'ring', color: 'var(--accent-cyan)', size: 36, top: '7%', left: '94%', blur: 0, opacity: 0.24, dx: -20, dy: 30, dur: 9200, delay: 800 },
  { id: 18, layer: 3, type: 'circle', color: 'var(--amber-primary)', size: 20, top: '70%', left: '95%', blur: 0, opacity: 0.24, dx: -25, dy: -15, dur: 8600, delay: 1000 },
  { id: 19, layer: 3, type: 'ring', color: 'var(--accent-indigo)', size: 60, top: '32%', left: '24%', blur: 2, opacity: 0.14, dx: -20, dy: 25, dur: 13500, delay: 300 },
  { id: 20, layer: 3, type: 'rounded-square', color: 'var(--accent-cyan)', size: 24, top: '5%', left: '26%', blur: 0, opacity: 0.2, dx: 15, dy: 15, dur: 8800, delay: 1200 },
  { id: 21, layer: 3, type: 'circle', color: 'var(--emerald-primary)', size: 36, top: '48%', left: '3%', blur: 1, opacity: 0.15, dx: 25, dy: -30, dur: 12800, delay: 1500 },
  { id: 22, layer: 3, type: 'ring', color: 'var(--accent-cyan)', size: 42, top: '22%', left: '56%', blur: 0, opacity: 0.18, dx: -20, dy: 20, dur: 10200, delay: 700 },
  { id: 23, layer: 3, type: 'rounded-square', color: 'var(--accent-indigo)', size: 28, top: '80%', left: '48%', blur: 1, opacity: 0.16, dx: 20, dy: -20, dur: 11200, delay: 900 },
  { id: 24, layer: 3, type: 'circle', color: 'var(--accent-cyan)', size: 22, top: '92%', left: '88%', blur: 0, opacity: 0.22, dx: -15, dy: -25, dur: 8900, delay: 400 }
];

export default function FloatingBackground() {
  const containerRef = useRef(null);
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);
  const animInstancesRef = useRef([]);
  const prefersReducedMotion = useReducedMotion();
  const { isDark } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Multi-layered animation with animejs v4
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    const shapes = containerRef.current.querySelectorAll('.floating-shape-item');
    if (!shapes || shapes.length === 0) return;

    animInstancesRef.current.forEach((a) => {
      if (a && typeof a.cancel === 'function') a.cancel();
    });
    animInstancesRef.current = [];

    shapes.forEach((shape, index) => {
      const cfg = SHAPES_CONFIG[index];
      if (!cfg) return;

      try {
        const anim = animate(shape, {
          translateX: [0, cfg.dx],
          translateY: [0, cfg.dy],
          rotate: [0, (index % 2 === 0 ? 1 : -1) * (12 + (index % 4) * 6)],
          scale: cfg.type === 'orb' ? [1, 1.08] : [1, 1.05],
          duration: cfg.dur,
          delay: cfg.delay,
          loop: true,
          alternate: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(anim);
      } catch (err) {
        // Fallback
      }
    });

    // Pause when document is hidden
    function handleVisibility() {
      const isHidden = document.visibilityState === 'hidden';
      animInstancesRef.current.forEach((anim) => {
        if (anim) {
          if (isHidden && typeof anim.pause === 'function') anim.pause();
          else if (!isHidden && typeof anim.play === 'function') anim.play();
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      animInstancesRef.current.forEach((a) => {
        if (a && typeof a.cancel === 'function') a.cancel();
      });
      animInstancesRef.current = [];
    };
  }, [prefersReducedMotion, isMobile]);

  // Multi-layer mouse parallax
  useEffect(() => {
    if (prefersReducedMotion || isMobile) return;

    let ticking = false;
    function handleMouseMove(e) {
      if (!ticking) {
        requestAnimationFrame(() => {
          const normX = e.clientX / window.innerWidth - 0.5;
          const normY = e.clientY / window.innerHeight - 0.5;

          if (layer1Ref.current) {
            layer1Ref.current.style.transform = `translate3d(${normX * 12}px, ${normY * 12}px, 0)`;
          }
          if (layer2Ref.current) {
            layer2Ref.current.style.transform = `translate3d(${normX * 22}px, ${normY * 22}px, 0)`;
          }
          if (layer3Ref.current) {
            layer3Ref.current.style.transform = `translate3d(${normX * 34}px, ${normY * 34}px, 0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReducedMotion, isMobile]);

  // Mobile optimization: 10 shapes on mobile, 24 on desktop
  const activeShapes = isMobile ? SHAPES_CONFIG.slice(0, 10) : SHAPES_CONFIG;
  const opacityMultiplier = isDark ? 1 : 0.55;

  return (
    <div 
      className="floating-bg-container"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden'
      }}
    >
      {/* Subtle digital trust grid */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255, 255, 255, ${isDark ? '0.04' : '0.08'}) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.7
        }}
      />

      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        {/* Layer 1: Deep Orbs */}
        <div ref={layer1Ref} style={{ position: 'absolute', inset: 0, transition: 'transform 180ms ease-out' }}>
          {activeShapes.filter(s => s.layer === 1).map((shape) => (
            <div
              key={shape.id}
              className="floating-shape-item"
              style={{
                position: 'absolute',
                top: shape.top,
                left: shape.left,
                width: shape.size,
                height: shape.size,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${shape.color} 0%, transparent 70%)`,
                opacity: shape.opacity * opacityMultiplier,
                filter: `blur(${shape.blur}px)`,
                willChange: 'transform'
              }}
            />
          ))}
        </div>

        {/* Layer 2: Midground Trust Symbols */}
        <div ref={layer2Ref} style={{ position: 'absolute', inset: 0, transition: 'transform 140ms ease-out' }}>
          {activeShapes.filter(s => s.layer === 2).map((shape) => (
            <div
              key={shape.id}
              className="floating-shape-item"
              style={{
                position: 'absolute',
                top: shape.top,
                left: shape.left,
                color: shape.color,
                opacity: shape.opacity * opacityMultiplier,
                filter: shape.blur ? `blur(${shape.blur}px)` : 'none',
                willChange: 'transform'
              }}
            >
              {shape.type === 'shield' && <ShieldShape size={shape.size} />}
              {shape.type === 'key' && <KeyShape size={shape.size} />}
              {shape.type === 'lock' && <LockShape size={shape.size} />}
              {shape.type === 'qr' && <QrGlyphShape size={shape.size} />}
            </div>
          ))}
        </div>

        {/* Layer 3: Foreground Crisp Shapes & Rings */}
        <div ref={layer3Ref} style={{ position: 'absolute', inset: 0, transition: 'transform 100ms ease-out' }}>
          {activeShapes.filter(s => s.layer === 3).map((shape) => (
            <div
              key={shape.id}
              className="floating-shape-item"
              style={{
                position: 'absolute',
                top: shape.top,
                left: shape.left,
                color: shape.color,
                opacity: shape.opacity * opacityMultiplier,
                filter: shape.blur ? `blur(${shape.blur}px)` : 'none',
                willChange: 'transform'
              }}
            >
              {shape.type === 'circle' && (
                <div
                  style={{
                    width: shape.size,
                    height: shape.size,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${shape.color}, transparent)`,
                    border: `1px solid ${shape.color}`
                  }}
                />
              )}
              {shape.type === 'rounded-square' && (
                <div
                  style={{
                    width: shape.size,
                    height: shape.size,
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${shape.color}, transparent)`,
                    border: `1px solid ${shape.color}`
                  }}
                />
              )}
              {shape.type === 'ring' && (
                <div
                  style={{
                    width: shape.size,
                    height: shape.size,
                    borderRadius: '50%',
                    border: `2px dashed ${shape.color}`
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
