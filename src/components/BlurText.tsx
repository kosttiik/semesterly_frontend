import React, { useEffect, useRef, useState } from 'react';
import {
  useSprings,
  easings,
  animated,
  SpringValues,
  SpringConfig,
} from '@react-spring/web';

interface AnimationState extends React.CSSProperties {
  filter?: string;
  opacity?: number;
  transform?: string;
}

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: AnimationState;
  animationTo?: AnimationState[];
  easing?: keyof typeof easings;
  onAnimationComplete?: () => void;
}

const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = 'easeOutCubic',
  onAnimationComplete,
}) => {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const animatedCount = useRef(0);

  const elements = animateBy === 'words' ? text.split(' ') : text.split('');

  const defaultFrom: AnimationState =
    direction === 'top'
      ? {
          filter: 'blur(10px)',
          opacity: 0,
          transform: 'translate3d(0,-50px,0)',
        }
      : {
          filter: 'blur(10px)',
          opacity: 0,
          transform: 'translate3d(0,50px,0)',
        };

  const defaultTo: AnimationState[] = [
    {
      filter: 'blur(5px)',
      opacity: 0.5,
      transform:
        direction === 'top' ? 'translate3d(0,5px,0)' : 'translate3d(0,-5px,0)',
    },
    { filter: 'blur(0px)', opacity: 1, transform: 'translate3d(0,0,0)' },
  ];

  useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(ref.current!);
          }
        },
        { threshold, rootMargin }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [threshold, rootMargin]);

  const springs: SpringValues<AnimationState>[] = useSprings(
    elements.length,
    elements.map((_, i) => ({
      from: animationFrom || defaultFrom,
      to: inView
        ? async (next: (props: AnimationState) => Promise<void>) => {
            for (const step of animationTo || defaultTo) {
              await next(step);
            }
            animatedCount.current += 1;
            if (
              animatedCount.current === elements.length &&
              onAnimationComplete
            ) {
              onAnimationComplete();
            }
          }
        : animationFrom || defaultFrom,
      delay: i * delay,
      config: { easing: easings[easing], duration: 400 } as SpringConfig,
    }))
  );

  return (
    <p ref={ref} className={className}>
      {springs.map((props, i) => (
        <animated.span
          key={i}
          style={{
            ...props,
            display: 'inline-block',
            willChange: 'transform, filter, opacity',
            fontSize: '36px',
          }}
        >
          {elements[i]}
          {animateBy === 'words' && i < elements.length - 1 ? ' ' : ''}
        </animated.span>
      ))}
    </p>
  );
};

export default BlurText;
