import { screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { aProduct, aTransaction, fakeServices } from './test/fakes';
import { renderWithStore } from './test/render';

describe('App', () => {
  it('runs the whole checkout: product, details, summary, status and back with fresh stock', async () => {
    const services = fakeServices({
      getProducts: jest
        .fn()
        .mockResolvedValueOnce([aProduct({ availableUnits: 5 })])
        .mockResolvedValue([aProduct({ availableUnits: 4 })]),
      getTransaction: jest.fn().mockResolvedValueOnce(aTransaction()).mockResolvedValue(aTransaction({ status: 'APPROVED' })),
    });
    const { user } = renderWithStore(<App />, { services, products: { status: 'idle', items: [] } });

    expect(await screen.findByText('5 disponibles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pagar con tarjeta/ }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Número de tarjeta'), '4242424242424242');
    await user.type(within(dialog).getByLabelText('Nombre del titular'), 'Ana Gomez');
    await user.type(within(dialog).getByLabelText('Vence'), '1229');
    await user.type(within(dialog).getByLabelText('CVC'), '123');
    await user.type(within(dialog).getByLabelText('Correo electrónico'), 'ana@example.com');
    await user.type(within(dialog).getByLabelText('Nombre completo'), 'Ana Gomez');
    await user.type(within(dialog).getByLabelText('Celular'), '3001234567');
    await user.type(within(dialog).getByLabelText('Quién recibe'), 'Ana Gomez');
    await user.type(within(dialog).getByLabelText('Teléfono de quien recibe'), '3001234567');
    await user.type(within(dialog).getByLabelText('Dirección'), 'Calle 10 # 43-12');
    await user.type(within(dialog).getByLabelText('Ciudad'), 'Medellín');
    await user.type(within(dialog).getByLabelText('Departamento'), 'Antioquia');
    await user.type(within(dialog).getByLabelText('Código postal'), '050021');
    await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));

    expect(await screen.findByRole('heading', { name: 'Resumen del pago' })).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Pagar \$/ }));

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a la tienda' }));
    await waitFor(() => expect(screen.getByText('4 disponibles')).toBeInTheDocument());
    expect(services.api.getProducts).toHaveBeenCalledTimes(2);
  });
});
