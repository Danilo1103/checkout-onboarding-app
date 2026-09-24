import { screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../../api/http';
import { fakeServices, validCustomer, validShipping } from '../../../test/fakes';
import { renderWithStore } from '../../../test/render';
import { SummaryBackdrop } from './SummaryBackdrop';

const summary = {
  step: 'summary' as const,
  productId: 'prod-headphones',
  quantity: 1,
  customer: validCustomer,
  shipping: validShipping,
  card: { brand: 'VISA' as const, last4: '4242' },
  cardToken: 'tok_1',
};

describe('SummaryBackdrop', () => {
  it('shows skeletons, then the server amounts, card and address', async () => {
    renderWithStore(<SummaryBackdrop />, { checkout: summary });
    expect(screen.getAllByTestId('summary-skeleton')).toHaveLength(4);
    expect(await screen.findByText('Tarifa base')).toBeInTheDocument();
    expect(screen.getByText(/364\.900/, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Tarjeta terminada en 4242')).toBeInTheDocument();
    expect(screen.getByText('Calle 10 # 43-12, Medellín')).toBeInTheDocument();
    expect(screen.getByText('1 × Aurora Wireless Headphones')).toBeInTheDocument();
  });

  it('requires accepting the terms before paying, then pays', async () => {
    const { user, store, services } = renderWithStore(<SummaryBackdrop />, { checkout: summary });
    const payButton = await screen.findByRole('button', { name: /Pagar \$/ });
    expect(payButton).toBeDisabled();
    expect(screen.getByRole('link', { name: 'reglamento de uso' })).toHaveAttribute('href', 'https://terms.test');

    await user.click(screen.getByRole('checkbox'));
    await user.click(payButton);
    await waitFor(() => expect(store.getState().checkout.step).toBe('status'));
    expect(services.api.createTransaction).toHaveBeenCalled();
  });

  it('shows payment errors and lets the customer edit the details', async () => {
    const services = fakeServices({
      createTransaction: jest.fn().mockRejectedValue(new ApiError('Solo quedan 0 unidades', 409)),
    });
    const { user, store } = renderWithStore(<SummaryBackdrop />, { services, checkout: { ...summary, acceptedTerms: true } });
    await user.click(await screen.findByRole('button', { name: /Pagar \$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 0 unidades');

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(store.getState().checkout.step).toBe('details');
  });

  it('works when the product is not in the catalog anymore', () => {
    renderWithStore(<SummaryBackdrop />, { checkout: { ...summary, card: null }, products: { items: [] } });
    expect(screen.getByText('1 × Producto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeDisabled();
  });
});
