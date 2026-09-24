import type { CardBrand } from '../../lib/card';

interface CardBrandLogoProps {
  brand: CardBrand;
  size?: number;
}

export function CardBrandLogo({ brand, size = 36 }: CardBrandLogoProps) {
  if (brand === 'VISA') {
    return (
      <svg width={size} height={size * 0.625} viewBox="0 0 48 30" role="img" aria-label="VISA">
        <rect width="48" height="30" rx="5" fill="#1a1f71" />
        <text x="24" y="20" textAnchor="middle" fontSize="13" fontWeight="800" fontStyle="italic" fill="#fff" fontFamily="Arial, sans-serif">
          VISA
        </text>
      </svg>
    );
  }
  if (brand === 'MASTERCARD') {
    return (
      <svg width={size} height={size * 0.625} viewBox="0 0 48 30" role="img" aria-label="Mastercard">
        <rect width="48" height="30" rx="5" fill="#16181d" />
        <circle cx="19" cy="15" r="8.5" fill="#eb001b" />
        <circle cx="29" cy="15" r="8.5" fill="#f79e1b" />
        <path d="M24 8.1a8.5 8.5 0 0 1 0 13.8 8.5 8.5 0 0 1 0-13.8z" fill="#ff5f00" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size * 0.625} viewBox="0 0 48 30" role="img" aria-label="Tarjeta">
      <rect x="0.5" y="0.5" width="47" height="29" rx="4.5" fill="#fff" stroke="#e4e2dc" />
      <rect x="6" y="9" width="36" height="4" rx="1" fill="#e4e2dc" />
      <rect x="6" y="18" width="14" height="3" rx="1" fill="#e4e2dc" />
    </svg>
  );
}
