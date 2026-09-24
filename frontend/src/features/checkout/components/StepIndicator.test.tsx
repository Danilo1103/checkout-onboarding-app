import { render, screen } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';

const items = () => screen.getAllByRole('listitem');

describe('StepIndicator', () => {
  it('marks previous steps as completed and highlights the current one', () => {
    render(<StepIndicator current={2} />);
    expect(items()[0]).toHaveTextContent('Datos, completado');
    expect(items()[1]).toHaveTextContent('Resumen, paso actual');
    expect(items()[1]).toHaveAttribute('aria-current', 'step');
    expect(items()[2]).toHaveTextContent('Resultado, pendiente');
  });

  it('shows the payment outcome on the last step', () => {
    const { rerender } = render(<StepIndicator current={3} outcome="success" />);
    expect(items()[2]).toHaveTextContent('Resultado, completado');
    rerender(<StepIndicator current={3} outcome="failed" />);
    expect(items()[2]).toHaveTextContent('Resultado, con error');
  });
});
