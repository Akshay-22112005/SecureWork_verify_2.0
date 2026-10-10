import React, { useEffect, useRef } from 'react';
import { Shield } from 'lucide-react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../context/ThemeContext';

export default function LoadingScreen({ 
  message = 'SecureWork Verify', 
  submessage = 'Initializing Cryptographic Trust Engine...',
  progress = null 
}) {
  const containerRef = useRef(null);
  const shieldRef = useRef(null);
  const ring1Ref = useRef(null);
  const ring2Ref = useRef(null);
  const progressBarRef = useRef(null);
  const animInstancesRef = useRef([]);
  const prefersReducedMotion = useReducedMotion();
  const { isDark } = useTheme();

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    animInstancesRef.current.forEach((a) => {
      if (a && typeof a.cancel === 'function') a.cancel();
    });
    animInstancesRef.current = [];

    try {
      // 1. Container fade-in
      const containerAnim = animate(containerRef.current, {
        opacity: [0, 1],
        duration: 350,
        ease: 'outQuad'
      });
      animInstancesRef.current.push(containerAnim);

      // 2. Shield core pulse & slight float
      if (shieldRef.current) {
        const shieldAnim = animate(shieldRef.current, {
          scale: [0.94, 1.06],
          opacity: [0.85, 1],
          duration: 1800,
          loop: true,
          alternate: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(shieldAnim);
      }

      // 3. Orbital rotating rings
      if (ring1Ref.current) {
        const ring1Anim = animate(ring1Ref.current, {
          rotate: [0, 360],
          duration: 3200,
          loop: true,
          ease: 'linear'
        });
        animInstancesRef.current.push(ring1Anim);
      }

      if (ring2Ref.current) {
        const ring2Anim = animate(ring2Ref.current, {
          rotate: [0, -360],
          duration: 2400,
          loop: true,
          ease: 'linear'
        });
        animInstancesRef.current.push(ring2Anim);
      }

      // 4. Progress bar sweep animation (if no fixed progress prop)
      if (progressBarRef.current && progress === null) {
        const barAnim = animate(progressBarRef.current, {
          translateX: ['-100%', '250%'],
          duration: 1600,
          loop: true,
          ease: 'inOutQuad'
        });
        animInstancesRef.current.push(barAnim);
      }
    } catch (e) {
      // Graceful fallback if animejs throws in SSR or detached DOM
    }

    // Pause animations when tab is hidden to save CPU/GPU cycles
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
  }, [prefersReducedMotion, progress]);

  return (
    <div 
      ref={containerRef}
      className={`loading-screen ${isDark ? 'dark-mode' : 'light-mode'}`}
      role="status"
      aria-live="polite"
      aria-label={`${message} - ${submessage}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden'
      }}
    >
      {/* Deep Ambient Glow Orb */}
      <div 
        style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-indigo-glow) 0%, transparent 70%)',
          filter: 'blur(70px)',
          opacity: isDark ? 0.7 : 0.35,
          pointerEvents: 'none',
          willChange: 'transform'
        }}
      />

      {/* Loader Container */}
      <div className="crypto-loader-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Orbital Shield Rings */}
        <div className="crypto-loader-rings" style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto' }}>
          {/* Ring 1 - Outer Indigo/Cyan Orbit */}
          <div 
            ref={ring1Ref}
            className="ring ring-outer"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px dashed var(--accent-indigo)',
              opacity: 0.8,
              boxShadow: '0 0 16px var(--accent-indigo-glow)'
            }}
          />

          {/* Ring 2 - Inner Emerald Orbit */}
          <div 
            ref={ring2Ref}
            className="ring ring-middle"
            style={{
              position: 'absolute',
              inset: '12px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--accent-cyan)',
              borderBottomColor: 'var(--emerald-primary)',
              opacity: 0.85
            }}
          />

          {/* Center Shield Core */}
          <div 
            ref={shieldRef}
            className="loader-core-icon"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo-light)'
            }}
          >
            <Shield size={38} strokeWidth={2.2} />
          </div>
        </div>

        {/* Text Details */}
        <div className="crypto-loader-text" style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            {message}
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: 0 }}>
            {submessage}
          </p>
        </div>

        {/* High-Tech Progress Bar */}
        <div 
          className="crypto-loader-bar"
          style={{
            width: '220px',
            height: '4px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            margin: '1.25rem auto 0 auto',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {progress !== null ? (
            <div 
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan), var(--emerald-primary))',
                borderRadius: 'var(--radius-full)',
                transition: 'width 250ms ease-out'
              }}
            />
          ) : (
            <div 
              ref={progressBarRef}
              className="crypto-loader-progress"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '45%',
                background: 'linear-gradient(90deg, transparent, var(--accent-indigo), var(--accent-cyan), transparent)',
                borderRadius: 'var(--radius-full)'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
