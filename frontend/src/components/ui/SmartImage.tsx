import { useState } from 'react';
import styles from './SmartImage.module.css';

interface SmartImageProps {
  src: string;
  alt: string;
  /** Rendered width in CSS pixels, used to pick the right source. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/** Responsive WebP image with a reserved box, skeleton background and fade-in. */
export function SmartImage({ src, alt, sizes = '(min-width: 720px) 320px, 100vw', priority, className }: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const small = src.replace(/\.webp$/, '-360.webp');
  return (
    <div className={[styles.frame, loaded ? styles.loaded : '', className ?? ''].join(' ').trim()}>
      <img
        src={src}
        srcSet={`${small} 360w, ${src} 720w`}
        sizes={sizes}
        alt={alt}
        width={720}
        height={720}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        className={styles.image}
      />
    </div>
  );
}
