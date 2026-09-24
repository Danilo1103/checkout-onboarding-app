import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.logo} aria-hidden="true">
          ◆
        </span>
        <span className={styles.brand}>Nova Store</span>
        <span className={styles.secure}>Pago seguro</span>
      </div>
    </header>
  );
}
