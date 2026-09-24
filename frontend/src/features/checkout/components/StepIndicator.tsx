import styles from './StepIndicator.module.css';

const STEPS = ['Datos', 'Resumen', 'Resultado'];

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className={styles.steps} aria-label="Progreso del pago">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? styles.done : step === current ? styles.current : '';
        return (
          <li key={label} className={state} aria-current={step === current ? 'step' : undefined}>
            <span className={styles.dot}>{step < current ? '✓' : step}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
