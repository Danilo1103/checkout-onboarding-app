import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  adornment?: ReactNode;
}

export function TextField({ label, error, adornment, className, ...input }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={[styles.control, error ? styles.invalid : ''].join(' ').trim()}>
        <input
          {...input}
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {adornment && <span className={styles.adornment}>{adornment}</span>}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
