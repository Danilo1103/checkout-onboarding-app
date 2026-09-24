import { Skeleton } from '../../../components/ui/Skeleton';
import styles from './ProductCard.module.css';

export function ProductSkeleton() {
  return (
    <div className={styles.card} data-testid="product-skeleton">
      <Skeleton height="auto" radius={0} className="skeleton-media" />
      <div className={styles.body}>
        <Skeleton width={110} height={20} radius={999} />
        <Skeleton width="80%" height={22} />
        <Skeleton height={14} />
        <Skeleton width="60%" height={14} />
        <Skeleton width={120} height={28} />
        <Skeleton height={48} radius={999} />
      </div>
    </div>
  );
}
