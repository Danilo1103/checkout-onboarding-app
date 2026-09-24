import { screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../../api/http';
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
    expect(screen.getByText('Aurora Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText(/1 × \$\s?349\.900/)).toBeInTheDocument();

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

  it('shows the quantity and unit price even if the product is no longer listed', () => {
    renderWithStore(<StatusScreen onFinish={jest.fn()} />, {
      checkout: { step: 'status', transaction: aTransaction({ status: 'DECLINED', quantity: 2 }) },
      products: { items: [] },
    });
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText(/2 × \$\s?174\.950/)).toBeInTheDocument();
  });

  it('follows a payment known only by its id after a reload', async () => {
    renderWithStore(<StatusScreen onFinish={jest.fn()} />, {
      checkout: { step: 'status', transaction: null, paymentId: 'tx-1', productId: 'prod-headphones' },
    });
    expect(screen.getByRole('heading', { name: 'Procesando tu pago' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!' })).toBeInTheDocument();
  });

  it('explains when the payment was never created and lets the customer go back', async () => {
    const onFinish = jest.fn();
    const { user } = renderWithStore(<StatusScreen onFinish={onFinish} />, {
      services: fakeServices({ getTransaction: jest.fn().mockRejectedValue(new ApiError('Not found', 404)) }),
      checkout: { step: 'status', transaction: null, paymentId: 'tx-1' },
    });
    expect(await screen.findByRole('heading', { name: 'No pudimos confirmar el pago' })).toBeInTheDocument();
    expect(screen.getByText(/no se realizó ningún cobro/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Consultar de nuevo' }));
    await user.click(await screen.findByRole('button', { name: 'Volver a la tienda' }));
    expect(onFinish).toHaveBeenCalled();
  });
});
