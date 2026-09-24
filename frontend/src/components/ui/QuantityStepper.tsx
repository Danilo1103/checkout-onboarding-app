import styles from './QuantityStepper.module.css';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}

export function QuantityStepper({ value, max, onChange, label }: QuantityStepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Quitar una unidad">
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Agregar una unidad">
        +
      </button>
    </div>
  );
}
