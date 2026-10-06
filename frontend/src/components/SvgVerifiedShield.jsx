import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function SvgVerifiedShield({ size = 56, color = 'var(--emerald-primary)' }) {
  const shieldPathRef = useRef(null);
  const checkPathRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    try {
      if (shieldPathRef.current) {
        animate(shieldPathRef.current, {
          strokeDashoffset: [100, 0],
          duration: 900,
          ease: 'outExpo'
        });
      }

      if (checkPathRef.current) {
        animate(checkPathRef.current, {
          strokeDashoffset: [60, 0],
          delay: 400,
          duration: 600,
          ease: 'outBack'
        });
      }
    } catch {
      // Fallback
    }
  }, [prefersReducedMotion]);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 12px var(--emerald-glow))` }}
      >
        {/* Shield Contour Path */}
        <path
          ref={shieldPathRef}
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          strokeDasharray="100"
          strokeDashoffset="0"
        />
        {/* Checkmark Path */}
        <path
          ref={checkPathRef}
          d="m9 12 2 2 4-4"
          strokeDasharray="60"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  );
}
