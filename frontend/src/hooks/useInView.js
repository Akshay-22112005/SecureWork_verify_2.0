import { useState, useEffect, useRef } from 'react';

export function useInView(options = { threshold: 0.15, triggerOnce: true }) {
  const [isInView, setIsInView] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        if (options.triggerOnce) {
          observer.unobserve(el);
        }
      } else if (!options.triggerOnce) {
        setIsInView(false);
      }
    }, options);

    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [options.threshold, options.triggerOnce, options.rootMargin]);

  return [targetRef, isInView];
}

export default useInView;
