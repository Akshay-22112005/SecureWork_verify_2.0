import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * useTiltCards — Adds 3-D tilt-on-hover + radial light-follow to all
 * elements matching `selector` inside the returned containerRef.
 * Animates only CSS custom properties and transform — no layout reads,
 * GPU composited, 60fps.
 */
export function useTiltCards(selector = '.tilt-card') {
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion) return;

    const cards = Array.from(container.querySelectorAll(selector));
    if (cards.length === 0) return;

    const MAX_TILT = 8; // degrees

    function onMove(e, card) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -MAX_TILT;
      const rotateY = ((x - cx) / cx) * MAX_TILT;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
      card.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      card.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
    }

    function onLeave(card) {
      card.style.transform = '';
      card.style.removeProperty('--mouse-x');
      card.style.removeProperty('--mouse-y');
    }

    const handlers = cards.map((card) => {
      const move = (e) => onMove(e, card);
      const leave = () => onLeave(card);
      card.addEventListener('mousemove', move, { passive: true });
      card.addEventListener('mouseleave', leave, { passive: true });
      return { card, move, leave };
    });

    return () => {
      handlers.forEach(({ card, move, leave }) => {
        card.removeEventListener('mousemove', move);
        card.removeEventListener('mouseleave', leave);
        card.style.transform = '';
      });
    };
  }, [prefersReducedMotion, selector]);

  return containerRef;
}

export default useTiltCards;
