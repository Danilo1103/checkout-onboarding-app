import { screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../../api/http';
import { fakeServices, validCustomer, validShipping } from '../../../test/fakes';
import { renderWithStore } from '../../../test/render';
import { CheckoutModal } from './CheckoutModal';

const details = { step: 'details' as const, productId: 'prod-headphones', quantity: 1 };

const fillCard = async (user: ReturnType<typeof renderWithStore>['user'], number = '4242424242424242') => {
  await user.type(screen.getByLabelText('Número de tarjeta'), number);
  await user.type(screen.getByLabelText('Nombre del titular'), 'Ana Gomez');
  await user.type(screen.getByLabelText('Vence'), '1229');
  await user.type(screen.getByLabelText('CVC'), '123a');
};

describe('CheckoutModal', () => {
  it('formats the card while typing and shows the brand', async () => {
    const { user } = renderWithStore(<CheckoutModal />, { checkout: details });
    await fillCard(user, '5555555555554444');
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue('5555 5555 5555 4444');
    expect(screen.getByLabelText('Vence')).toHaveValue('12/29');
    expect(screen.getByLabelText('CVC')).toHaveValue('123');
    expect(screen.getAllByRole('img', { name: 'Mastercard' }).length).toBeGreaterThan(0);
  });

  it('shows errors only after leaving a field', async () => {
    const { user } = renderWithStore(<CheckoutModal />, { checkout: details });
    await user.type(screen.getByLabelText('Número de tarjeta'), '4242');
    expect(screen.queryByText('Número de tarjeta inválido')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText('Número de tarjeta inválido')).toBeInTheDocument();
  });

  it('marks every invalid field when submitting an empty form', async () => {
    const { user, services } = renderWithStore(<CheckoutModal />, { checkout: details });
    await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByText('Escribe la dirección completa')).toBeInTheDocument();
    expect(services.tokenizeCard).not.toHaveBeenCalled();
  });

  it('tokenizes the card and moves to the summary with prefilled contact data', async () => {
    const { user, store, services } = renderWithStore(<CheckoutModal />, {
      checkout: { ...details, customer: validCustomer, shipping: validShipping },
    });
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com');
    await fillCard(user);
    await user.clear(screen.getByLabelText('Nombre completo'));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana María Gómez');
    await user.clear(screen.getByLabelText('Quién recibe'));
    await user.type(screen.getByLabelText('Quién recibe'), 'Luis Gómez');
    await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));

    await waitFor(() => expect(store.getState().checkout.step).toBe('summary'));
    expect(services.tokenizeCard).toHaveBeenCalledWith({
      number: '4242 4242 4242 4242',
      holder: 'Ana Gomez',
      expiry: '12/29',
      cvc: '123',
    });
    expect(store.getState().checkout.customer.fullName).toBe('Ana María Gómez');
    expect(store.getState().checkout.shipping.recipient).toBe('Luis Gómez');
  });

  it('shows the tokenization error and the refresh notice', async () => {
    const services = fakeServices();
    services.tokenizeCard = jest.fn().mockRejectedValue(new ApiError('No pudimos validar tu tarjeta', 422));
    const { user } = renderWithStore(<CheckoutModal />, {
      services,
      checkout: { ...details, customer: validCustomer, shipping: validShipping, notice: 'Por seguridad, vuelve a ingresar' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Por seguridad');
    await fillCard(user);
    await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));
    expect(await screen.findByText('No pudimos validar tu tarjeta')).toBeInTheDocument();
  });

  it('closes with the close button and with Escape', async () => {
    const { user, store } = renderWithStore(<CheckoutModal />, { checkout: details });
    await user.keyboard('{Escape}');
    expect(store.getState().checkout.step).toBe('product');
  });

  it('closes when clicking outside and keeps focus inside with Tab', async () => {
    const { user, store } = renderWithStore(<CheckoutModal />, { checkout: details });
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const submit = screen.getByRole('button', { name: 'Continuar al resumen' });
    submit.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();

    await user.click(close);
    expect(store.getState().checkout.step).toBe('product');
  });

  it('closes when the overlay is clicked', async () => {
    const { user, store } = renderWithStore(<CheckoutModal />, { checkout: details });
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(store.getState().checkout.step).toBe('product');
  });
});
