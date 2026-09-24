import { CardBrandLogo } from '../../../components/ui/CardBrandLogo';
import { detectBrand, digitsOnly } from '../../../lib/card';
import styles from './CardPreview.module.css';

interface CardPreviewProps {
  number: string;
  holder: string;
  expiry: string;
}

const mask = (number: string) => {
  const digits = digitsOnly(number).padEnd(16, '•');
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
};

/** Live preview of the card being typed; the brand changes its colors. */
export function CardPreview({ number, holder, expiry }: CardPreviewProps) {
  const brand = detectBrand(number);
  return (
    <div className={[styles.card, styles[brand.toLowerCase()]].join(' ')} aria-hidden="true">
      <div className={styles.top}>
        <span className={styles.chip} />
        <CardBrandLogo brand={brand} size={48} />
      </div>
      <p className={styles.number}>{mask(number)}</p>
      <div className={styles.bottom}>
        <span className={styles.holder}>{holder.trim() || 'NOMBRE DEL TITULAR'}</span>
        <span>{expiry || 'MM/AA'}</span>
      </div>
    </div>
  );
}
