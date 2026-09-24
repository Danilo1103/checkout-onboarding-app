import { screen, waitFor } from '@testing-library/react';
import { aTransaction, fakeServices } from '../../../test/fakes';
import { renderWithStore } from '../../../test/render';
import { StatusScreen } from './StatusScreen';

describe('StatusScreen', () => {
  it('polls while pending and then shows the approved receipt', async () => {
    const onFinish = jest.fn();
    const { user, services } = renderWithStore(<StatusScreen onFinish={onFinish} />, {
      checkout: { step: 'status', transaction: aTransaction() },
    });
    expect(screen.getByRole('heading', { name: 'Procesando tu pago' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!' })).toBeInTheDocument();
    expect(services.api.getTransaction).toHaveBeenCalledWith('tx-1');
    expect(screen.getByText('TX-tx-1')).toBeInTheDocument();
    expect(screen.getByText('VISA •••• 4242')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver a la tienda' }));
    expect(onFinish).toHaveBeenCalled();
  });

  it.each([
    ['DECLINED', 'Pago rechazado'],
    ['VOIDED', 'Pago anulado'],
    ['ERROR', 'No pudimos procesar el pago'],
  ] as const)('shows the %s result without polling', (status, title) => {
    const { services } = renderWithStore(<StatusScreen onFinish={jest.fn()} />, {
      checkout: { step: 'status', transaction: aTransaction({ status }) },
    });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(services.api.getTransaction).not.toHaveBeenCalled();
  });

  it('offers to check again when polling fails', async () => {
    const getTransaction = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(aTransaction({ status: 'APPROVED' }));
    const { user } = renderWithStore(<StatusScreen onFinish={jest.fn()} />, {
      services: fakeServices({ getTransaction }),
      checkout: { step: 'status', transaction: aTransaction() },
    });
    await user.click(await screen.findByRole('button', { name: 'Consultar de nuevo' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '¡Pago aprobado!' })).toBeInTheDocument());
  });
});
