import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function ConfidenceRing({ 
  value = 100, 
  size = 64, 
  strokeWidth = 5, 
  color = 'var(--emerald-primary)', 
  trackColor = 'var(--border-subtle)',
  showText = true 
}) {
  const circleRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(Number(value) || 0, 0), 100);
  const targetOffset = circumference - (clampedValue / 100) * circumference;

  useEffect(() => {
    if (!circleRef.current) return;

    if (prefersReducedMotion) {
      circleRef.current.style.strokeDashoffset = `${targetOffset}`;
      return;
    }

    try {
      const anim = animate(circleRef.current, {
        strokeDashoffset: [circumference, targetOffset],
        duration: 1200,
        ease: 'outExpo'
      });
      return () => {
        if (anim && typeof anim.cancel === 'function') anim.cancel();
      };
    } catch {
      circleRef.current.style.strokeDashoffset = `${targetOffset}`;
    }
  }, [clampedValue, circumference, targetOffset, prefersReducedMotion]);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated Progress Ring */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      {showText && (
        <span 
          style={{ 
            position: 'absolute', 
            fontFamily: 'var(--font-mono)', 
            fontSize: size > 60 ? 'var(--text-xs)' : 'var(--text-2xs)', 
            fontWeight: 700, 
            color: 'var(--text-primary)' 
          }}
        >
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
