import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function useCountUp(endValue, duration = 1600, decimals = 0, startValue = 0) {
  const [displayValue, setDisplayValue] = useState(startValue);
  const prefersReducedMotion = useReducedMotion();
  const startTimeRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const target = Number(endValue);
    if (isNaN(target)) {
      setDisplayValue(endValue);
      return;
    }

    if (prefersReducedMotion) {
      setDisplayValue(target.toFixed(decimals));
      return;
    }

    const start = Number(startValue) || 0;
    startTimeRef.current = null;

    function step(timestamp) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Smooth ease-out exponential easing
      const easeOut = 1 - Math.pow(2, -10 * progress);
      const current = start + (target - start) * easeOut;

      setDisplayValue(decimals > 0 ? current.toFixed(decimals) : Math.round(current));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(decimals > 0 ? target.toFixed(decimals) : target);
      }
    }

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [endValue, duration, decimals, startValue, prefersReducedMotion]);

  return displayValue;
}

export default useCountUp;
