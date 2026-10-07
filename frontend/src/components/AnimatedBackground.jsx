import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Key, 
  FileCheck, 
  Award, 
  Fingerprint, 
  Code, 
  Terminal, 
  Lock, 
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../context/ThemeContext';

// Default domain-relevant floating glass tiles
const DEFAULT_TILES = [
  { id: 'tile-1', icon: ShieldCheck, label: 'Verified Shield', top: '14%', left: '7%', size: 44, color: '#a855f7', dur: '8s', delay: '0s', dx: '12px', dy: '-18px', rot: '6deg' },
  { id: 'tile-2', icon: Key, label: 'Ed25519 Key', top: '22%', right: '9%', size: 42, color: '#7c5cff', dur: '9.5s', delay: '1.2s', dx: '-14px', dy: '16px', rot: '-8deg' },
  { id: 'tile-3', icon: FileCheck, label: 'SHA-256 Hash', top: '48%', left: '4%', size: 46, color: '#38bdf8', dur: '11s', delay: '0.6s', dx: '16px', dy: '-14px', rot: '5deg' },
  { id: 'tile-4', icon: Award, label: 'Credential Badge', top: '65%', right: '6%', size: 44, color: '#c084fc', dur: '7.5s', delay: '2s', dx: '-12px', dy: '-16px', rot: '-5deg' },
  { id: 'tile-5', icon: Fingerprint, label: 'Biometric Trust', top: '82%', left: '10%', size: 42, color: '#818cf8', dur: '10s', delay: '1.5s', dx: '14px', dy: '12px', rot: '7deg' },
  { id: 'tile-6', icon: Terminal, label: 'Audit Proof', top: '8%', right: '22%', size: 40, color: '#a855f7', dur: '8.8s', delay: '0.4s', dx: '-10px', dy: '14px', rot: '-6deg' },
  { id: 'tile-7', icon: Lock, label: 'Zero-Knowledge', top: '78%', right: '20%', size: 42, color: '#38bdf8', dur: '9.2s', delay: '2.5s', dx: '15px', dy: '-12px', rot: '4deg' },
  { id: 'tile-8', icon: Code, label: 'Decentralized', top: '35%', right: '3%', size: 40, color: '#7c5cff', dur: '10.5s', delay: '1.8s', dx: '-16px', dy: '18px', rot: '-7deg' },
  { id: 'tile-9', icon: CheckCircle2, label: 'Consensus', top: '6%;', left: '26%', size: 38, color: '#34d399', dur: '8.2s', delay: '0.8s', dx: '10px', dy: '-12px', rot: '5deg' }
];

export default function AnimatedBackground({
  intensity = 'normal', // 'subtle' | 'normal' | 'vibrant'
  showParticles = true,
  showArcs = true,
  showGlow = true,
  showTiles = true,
  tiles = null,
  className = ''
}) {
  const canvasRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { isDark } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  // Responsiveness: detect mobile viewport
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter tiles for desktop vs mobile
  const activeTiles = useMemo(() => {
    const list = tiles || DEFAULT_TILES;
    if (isMobile) {
      // Pick first 4 tiles on mobile for clean look & performance
      return list.slice(0, 4);
    }
    return list;
  }, [tiles, isMobile]);

  // Particle Canvas Animation
  useEffect(() => {
    if (!showParticles || prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    function onCanvasResize() {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', onCanvasResize, { passive: true });

    // Particle pool: 45 on desktop, 20 on mobile
    const particleCount = isMobile ? 22 : 48;
    const particles = [];

    const colors = isDark 
      ? [
          'rgba(168, 85, 247, ', // purple
          'rgba(124, 92, 255, ', // violet
          'rgba(56, 189, 248, ', // sky cyan
          'rgba(255, 255, 255, '  // pure white twinkle
        ]
      : [
          'rgba(147, 51, 234, ',
          'rgba(99, 102, 241, ',
          'rgba(14, 165, 233, ',
          'rgba(100, 116, 139, '
        ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.6,
        baseAlpha: Math.random() * 0.45 + 0.2,
        colorBase: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 0.45 + 0.15,
        speedX: (Math.random() - 0.5) * 0.2,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }

    let isVisible = !document.hidden;
    function handleVisibility() {
      isVisible = !document.hidden;
    }
    document.addEventListener('visibilitychange', handleVisibility);

    let time = 0;
    function render() {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      time += 0.02;

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];

        // Move upward
        p.y -= p.speedY;
        p.x += p.speedX + Math.sin(time + p.twinkleOffset) * 0.15;

        // Wrap around viewport edges
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Twinkle factor
        const alpha = Math.max(0.08, p.baseAlpha + Math.sin(time * 2 + p.twinkleOffset) * 0.25);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorBase}${alpha})`;
        ctx.shadowBlur = p.radius > 1.2 ? 6 : 0;
        ctx.shadowColor = p.colorBase + '0.6)';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onCanvasResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [showParticles, prefersReducedMotion, isDark, isMobile]);

  // Opacity multipliers based on intensity prop
  const intensityMap = {
    subtle: 0.6,
    normal: 1.0,
    vibrant: 1.4
  };
  const mult = intensityMap[intensity] || 1.0;

  return (
    <div 
      className={`animated-hero-bg-root ${isDark ? 'dark-mode' : 'light-mode'} ${className}`}
      aria-hidden="true"
    >
      {/* ─── 1. Deep Radial Ambient Glows (CodeHelp style) ─── */}
      {showGlow && (
        <div className="bg-glow-layer">
          <div 
            className="glow-orb primary-glow"
            style={{ opacity: (isDark ? 0.32 : 0.18) * mult }}
          />
          <div 
            className="glow-orb secondary-glow"
            style={{ opacity: (isDark ? 0.22 : 0.12) * mult }}
          />
          <div 
            className="glow-orb accent-glow"
            style={{ opacity: (isDark ? 0.16 : 0.08) * mult }}
          />
        </div>
      )}

      {/* ─── 2. Concentric Arcs / Orbit Rings (CodeHelp style) ─── */}
      {showArcs && (
        <div className="concentric-arcs-container" style={{ opacity: isDark ? 1 : 0.6 }}>
          <svg 
            className="arcs-svg animate-arcs-spin" 
            viewBox="0 0 1000 1000" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outermost Arc */}
            <circle 
              cx="500" 
              cy="380" 
              r="440" 
              stroke="url(#arcGradient1)" 
              strokeWidth="1" 
              strokeDasharray="8 12" 
              opacity="0.22"
            />
            {/* Second Arc */}
            <circle 
              cx="500" 
              cy="380" 
              r="340" 
              stroke="url(#arcGradient2)" 
              strokeWidth="1" 
              strokeDasharray="4 8" 
              opacity="0.3"
            />
            {/* Third Arc */}
            <circle 
              cx="500" 
              cy="380" 
              r="240" 
              stroke="url(#arcGradient1)" 
              strokeWidth="1.2" 
              opacity="0.38"
            />
            {/* Innermost Arc */}
            <circle 
              cx="500" 
              cy="380" 
              r="140" 
              stroke="url(#arcGradient2)" 
              strokeWidth="1" 
              strokeDasharray="2 6" 
              opacity="0.45"
            />

            <defs>
              <linearGradient id="arcGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#7c5cff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="arcGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
                <stop offset="70%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}

      {/* ─── 3. Drifting Twinkling Particles Canvas ─── */}
      {showParticles && !prefersReducedMotion && (
        <canvas ref={canvasRef} className="particles-canvas" />
      )}

      {/* ─── 4. Floating Glass Icon Tiles ─── */}
      {showTiles && (
        <div className="floating-tiles-layer">
          {activeTiles.map((tile, idx) => {
            const Icon = tile.icon;
            const style = {
              top: tile.top,
              left: tile.left,
              right: tile.right,
              bottom: tile.bottom,
              width: `${tile.size}px`,
              height: `${tile.size}px`,
              animationDuration: prefersReducedMotion ? '0s' : tile.dur,
              animationDelay: prefersReducedMotion ? '0s' : tile.delay,
              '--dx': tile.dx,
              '--dy': tile.dy,
              '--rot': tile.rot
            };

            return (
              <div 
                key={tile.id || idx}
                className="floating-glass-tile"
                style={style}
                title={tile.label}
              >
                <div className="tile-glow-indicator" style={{ background: tile.color }} />
                <Icon size={Math.round(tile.size * 0.48)} color={tile.color} strokeWidth={1.8} />
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle Micro-Grid overlay */}
      <div className="bg-micro-grid" />
    </div>
  );
}
