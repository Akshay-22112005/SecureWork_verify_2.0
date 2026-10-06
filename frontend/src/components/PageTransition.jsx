import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function PageTransition({ children }) {
  const containerRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!containerRef.current) return;

    if (prefersReducedMotion) {
      containerRef.current.style.opacity = '1';
      containerRef.current.style.transform = 'none';
      return;
    }

    try {
      // 1. Page-level fade + slide-up entrance
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 360,
        ease: 'outQuad'
      });

      // 2. Staggered card and table row entrance
      const staggerElements = containerRef.current.querySelectorAll(
        '.glass-card, .card, .stat-card, .metric-card, .trust-card, .role-portal-card, .data-table tbody tr, .table-modern tbody tr'
      );

      if (staggerElements && staggerElements.length > 0) {
        animate(staggerElements, {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 380,
          delay: stagger(45, { start: 80 }),
          ease: 'outQuad'
        });
      }

      // 3. Automated count-up for numbers inside stat / metric values
      const numericElements = containerRef.current.querySelectorAll(
        '.stat-card-value, .metric-value, .stat-value, [data-countup="true"]'
      );

      numericElements.forEach((el) => {
        const text = el.innerText.trim();
        // Match numbers like "120", "94.8", "1,048,576"
        const cleanNum = text.replace(/[%,$#+]/g, '').trim();
        const targetNumber = parseFloat(cleanNum);

        if (!isNaN(targetNumber) && targetNumber > 0) {
          const hasPercent = text.includes('%');
          const hasDollar = text.includes('$');
          const hasPlus = text.includes('+');
          const isFloat = text.includes('.') && cleanNum.split('.')[1]?.length > 0;
          const decimals = isFloat ? cleanNum.split('.')[1].length : 0;

          let start = 0;
          const duration = 1200;
          let startTime = null;

          function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(2, -10 * progress);
            const current = start + (targetNumber - start) * easeOut;
            const formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current);

            let result = formatted;
            if (hasDollar) result = `$${result}`;
            if (hasPercent) result = `${result}%`;
            if (hasPlus) result = `${result}+`;

            el.innerText = result;

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.innerText = text; // Ensure exact final text
            }
          }

          requestAnimationFrame(step);
        }
      });
    } catch (e) {
      // Graceful fallback
    }
  }, [location.pathname, prefersReducedMotion]);

  return (
    <div 
      ref={containerRef} 
      className="page-transition-wrapper"
      style={{ width: '100%', minHeight: '100%' }}
    >
      {children}
    </div>
  );
}
