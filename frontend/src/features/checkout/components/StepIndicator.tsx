import styles from './StepIndicator.module.css';

const STEPS = ['Datos', 'Resumen', 'Resultado'] as const;

type Outcome = 'success' | 'failed';

interface StepIndicatorProps {
  current: 1 | 2 | 3;
  /** Final result of the payment, shown on the last step. */
  outcome?: Outcome;
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const stateOf = (step: number, current: number, outcome?: Outcome) => {
  if (step < current) return 'done';
  if (step === current && outcome === 'success') return 'done';
  if (step === current && outcome === 'failed') return 'failed';
  if (step === current) return 'current';
  return 'upcoming';
};

const LABEL_BY_STATE = {
  done: 'completado',
  failed: 'con error',
  current: 'paso actual',
  upcoming: 'pendiente',
} as const;

export function StepIndicator({ current, outcome }: StepIndicatorProps) {
  return (
    <ol className={styles.steps} aria-label="Progreso del pago">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = stateOf(step, current, outcome);
        return (
          <li
            key={label}
            className={[styles.step, styles[state]].join(' ')}
            aria-current={step === current ? 'step' : undefined}
          >
            <span className={styles.dot}>
              {state === 'done' ? <CheckIcon /> : state === 'failed' ? <CrossIcon /> : step}
            </span>
            <span className={styles.label}>
              {label}
              <span className="visually-hidden">, {LABEL_BY_STATE[state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
