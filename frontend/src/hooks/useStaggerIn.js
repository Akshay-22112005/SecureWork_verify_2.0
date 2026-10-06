import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { useReducedMotion } from './useReducedMotion';

export function useStaggerIn(selector = '.animate-stagger-item', deps = [], options = {}) {
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    const elements = containerRef.current.querySelectorAll(selector);
    if (!elements || elements.length === 0) return;

    try {
      const anim = animate(elements, {
        opacity: [0, 1],
        translateY: [options.translateY || 16, 0],
        duration: options.duration || 450,
        delay: stagger(options.staggerDelay || 50, { start: options.startDelay || 60 }),
        ease: options.ease || 'outQuad'
      });

      return () => {
        if (anim && typeof anim.cancel === 'function') {
          anim.cancel();
        }
      };
    } catch (e) {
      // Graceful fallback if animejs cannot bind
      elements.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  }, [prefersReducedMotion, selector, ...deps]);

  return containerRef;
}

export default useStaggerIn;
