import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * useScrollReveal — Watches all child elements matching `selector`
 * inside the returned containerRef. When each enters the viewport it
 * gets the `visibleClass` added (default: 'is-visible').
 *
 * The companion CSS classes (reveal-fade, reveal-left, reveal-right,
 * reveal-stagger) in portal-motion.css handle the actual transition.
 *
 * This is intentionally separate from useInView (which is a stateful hook
 * for a single element) and useStaggerIn (which drives anime.js directly).
 */
export function useScrollReveal({
  selector = '.reveal-fade, .reveal-left, .reveal-right',
  visibleClass = 'is-visible',
  threshold = 0.12,
  rootMargin = '0px 0px -40px 0px',
} = {}) {
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = Array.from(
      container.querySelectorAll(selector)
    );

    if (targets.length === 0) return;

    // Reduced motion: make everything visible immediately
    if (prefersReducedMotion) {
      targets.forEach((el) => el.classList.add(visibleClass));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(visibleClass);
            observer.unobserve(entry.target); // once only
          }
        });
      },
      { threshold, rootMargin }
    );

    targets.forEach((el) => observer.observe(el));

    return () => {
      targets.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [prefersReducedMotion, selector, visibleClass, threshold, rootMargin]);

  return containerRef;
}

export default useScrollReveal;
