'use client';

import { useRef, useState, useEffect } from 'react';
import { useInView, useMotionValue, animate } from 'framer-motion';

interface CountUpProps {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function CountUp({
  target,
  duration = 2,
  suffix = '',
  prefix = '',
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionValue, target, {
      duration,
      ease: 'easeOut',
    });
    const unsubscribe = motionValue.on('change', (v) => {
      setDisplay(Math.round(v));
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [isInView, target, duration, motionValue]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}
