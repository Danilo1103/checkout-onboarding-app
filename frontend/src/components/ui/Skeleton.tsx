import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className }: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, className ?? ''].join(' ').trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
