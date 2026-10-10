import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function AnimateOnScroll({
  children,
  animation = 'fade-up', // 'fade-up' | 'fade-down' | 'fade-in' | 'scale' | 'stagger'
  duration = 500,
  delay = 0,
  threshold = 0.12,
  staggerSelector = null,
  staggerDelay = 55,
  className = '',
  style = {}
}) {
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      el.style.opacity = '1';
      el.style.transform = 'none';
      if (staggerSelector) {
        el.querySelectorAll(staggerSelector).forEach((child) => {
          child.style.opacity = '1';
          child.style.transform = 'none';
        });
      }
      return;
    }

    // Initial hidden state to prevent flash before intersection
    if (staggerSelector) {
      const items = el.querySelectorAll(staggerSelector);
      items.forEach((item) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
      });
    } else {
      el.style.opacity = '0';
      if (animation === 'fade-up') el.style.transform = 'translateY(24px)';
      else if (animation === 'fade-down') el.style.transform = 'translateY(-24px)';
      else if (animation === 'scale') el.style.transform = 'scale(0.95)';
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          try {
            if (staggerSelector) {
              const items = el.querySelectorAll(staggerSelector);
              if (items && items.length > 0) {
                animRef.current = animate(items, {
                  opacity: [0, 1],
                  translateY: [20, 0],
                  duration: duration || 480,
                  delay: stagger(staggerDelay || 55, { start: delay || 0 }),
                  ease: 'outQuad'
                });
              }
            } else {
              const animParams = {
                opacity: [0, 1],
                duration: duration || 500,
                delay: delay || 0,
                ease: 'outQuad'
              };

              if (animation === 'fade-up') animParams.translateY = [24, 0];
              else if (animation === 'fade-down') animParams.translateY = [-24, 0];
              else if (animation === 'scale') animParams.scale = [0.95, 1];

              animRef.current = animate(el, animParams);
            }
          } catch (e) {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }

          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
      if (animRef.current && typeof animRef.current.cancel === 'function') {
        animRef.current.cancel();
      }
    };
  }, [animation, duration, delay, threshold, staggerSelector, staggerDelay, prefersReducedMotion]);

  return (
    <div ref={containerRef} className={`animate-on-scroll ${className}`} style={style}>
      {children}
    </div>
  );
}
