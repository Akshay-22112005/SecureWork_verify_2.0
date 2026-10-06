import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

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

// Pre-defined geometric configurations (18 rich shapes)
const SHAPES_CONFIG = [
  { id: 1, type: 'circle', color: 'var(--accent-indigo)', size: 48, top: '12%', left: '8%', blur: 2, opacity: 0.22, dx: 35, dy: -40, dur: 9000, delay: 0 },
  { id: 2, type: 'shield', color: 'var(--emerald-primary)', size: 38, top: '22%', left: '82%', blur: 1, opacity: 0.28, dx: -45, dy: 30, dur: 11000, delay: 500 },
  { id: 3, type: 'rounded-square', color: 'var(--accent-cyan)', size: 42, top: '65%', left: '14%', blur: 2, opacity: 0.2, dx: 30, dy: 45, dur: 10000, delay: 1000 },
  { id: 4, type: 'ring', color: 'var(--accent-indigo)', size: 54, top: '78%', left: '76%', blur: 1, opacity: 0.24, dx: -35, dy: -35, dur: 12000, delay: 1500 },
  { id: 5, type: 'key', color: 'var(--accent-cyan)', size: 32, top: '15%', left: '45%', blur: 1, opacity: 0.26, dx: 25, dy: -25, dur: 9500, delay: 800 },
  { id: 6, type: 'qr', color: 'var(--accent-indigo)', size: 36, top: '48%', left: '90%', blur: 1, opacity: 0.22, dx: -40, dy: 20, dur: 13000, delay: 1200 },
  { id: 7, type: 'lock', color: 'var(--amber-primary)', size: 30, top: '85%', left: '38%', blur: 1, opacity: 0.24, dx: -20, dy: -40, dur: 10500, delay: 300 },
  { id: 8, type: 'circle', color: 'var(--emerald-primary)', size: 28, top: '40%', left: '6%', blur: 1, opacity: 0.25, dx: 40, dy: 30, dur: 8500, delay: 600 },
  { id: 9, type: 'rounded-square', color: 'var(--accent-indigo)', size: 34, top: '32%', left: '68%', blur: 2, opacity: 0.18, dx: -30, dy: -30, dur: 11500, delay: 1400 },
  { id: 10, type: 'ring', color: 'var(--accent-cyan)', size: 38, top: '8%', left: '92%', blur: 1, opacity: 0.25, dx: -25, dy: 35, dur: 9800, delay: 900 },
  { id: 11, type: 'shield', color: 'var(--accent-indigo)', size: 32, top: '58%', left: '52%', blur: 1, opacity: 0.18, dx: 20, dy: 25, dur: 12500, delay: 400 },
  { id: 12, type: 'circle', color: 'var(--amber-primary)', size: 22, top: '72%', left: '94%', blur: 1, opacity: 0.26, dx: -30, dy: -20, dur: 8800, delay: 1100 },
  { id: 13, type: 'qr', color: 'var(--emerald-primary)', size: 28, top: '88%', left: '18%', blur: 1, opacity: 0.2, dx: 35, dy: -25, dur: 10200, delay: 700 },
  { id: 14, type: 'ring', color: 'var(--accent-indigo)', size: 64, top: '35%', left: '26%', blur: 3, opacity: 0.15, dx: -25, dy: 30, dur: 14000, delay: 200 },
  { id: 15, type: 'rounded-square', color: 'var(--accent-cyan)', size: 26, top: '4%', left: '28%', blur: 1, opacity: 0.22, dx: 20, dy: 20, dur: 9200, delay: 1300 },
  { id: 16, type: 'lock', color: 'var(--accent-indigo)', size: 24, top: '92%', left: '62%', blur: 1, opacity: 0.24, dx: 15, dy: -30, dur: 11800, delay: 500 },
  { id: 17, type: 'circle', color: 'var(--emerald-primary)', size: 40, top: '50%', left: '4%', blur: 2, opacity: 0.16, dx: 30, dy: -35, dur: 13500, delay: 1600 },
  { id: 18, type: 'key', color: 'var(--accent-indigo)', size: 28, top: '2%', left: '70%', blur: 1, opacity: 0.25, dx: -35, dy: 20, dur: 10800, delay: 100 }
];

export default function FloatingBackground() {
  const containerRef = useRef(null);
  const animInstancesRef = useRef([]);
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  // Check viewport width for performance optimization (fewer shapes on mobile)
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animate shapes with animejs v4 looping paths
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    const shapes = containerRef.current.querySelectorAll('.floating-shape-item');
    if (!shapes || shapes.length === 0) return;

    // Clear any previous animations
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
          rotate: [0, (index % 2 === 0 ? 1 : -1) * (15 + (index % 4) * 8)],
          duration: cfg.dur,
          delay: cfg.delay,
          loop: true,
          alternate: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(anim);
      } catch (err) {
        // Fallback gracefully
      }
    });

    // Pause animations when tab is hidden for performance
    function handleVisibility() {
      const isHidden = document.visibilityState === 'hidden';
      animInstancesRef.current.forEach((anim) => {
        if (anim) {
          if (isHidden && typeof anim.pause === 'function') {
            anim.pause();
          } else if (!isHidden && typeof anim.play === 'function') {
            anim.play();
          }
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

  // Subtle throttled mouse parallax on desktop
  useEffect(() => {
    if (prefersReducedMotion || isMobile) return;

    let ticking = false;
    function handleMouseMove(e) {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const x = (e.clientX / window.innerWidth - 0.5) * 24;
          const y = (e.clientY / window.innerHeight - 0.5) * 24;
          containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReducedMotion, isMobile]);

  // Render fewer shapes on mobile (8 shapes) for smooth 60fps
  const activeShapes = isMobile ? SHAPES_CONFIG.slice(0, 8) : SHAPES_CONFIG;

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
      {/* Faint subtle ambient grid overlay */}
      <div 
        className="floating-bg-grid"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.6
        }}
      />

      {/* Floating Shapes Canvas */}
      <div 
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          transition: 'transform 120ms cubic-bezier(0.1, 0.9, 0.2, 1)'
        }}
      >
        {activeShapes.map((shape) => {
          return (
            <div
              key={shape.id}
              className="floating-shape-item"
              style={{
                position: 'absolute',
                top: shape.top,
                left: shape.left,
                color: shape.color,
                opacity: shape.opacity,
                filter: `blur(${shape.blur}px)`,
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
                    borderRadius: '12px',
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
              {shape.type === 'shield' && <ShieldShape size={shape.size} />}
              {shape.type === 'key' && <KeyShape size={shape.size} />}
              {shape.type === 'lock' && <LockShape size={shape.size} />}
              {shape.type === 'qr' && <QrGlyphShape size={shape.size} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
