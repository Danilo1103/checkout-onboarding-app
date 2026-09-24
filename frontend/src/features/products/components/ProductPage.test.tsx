import { fireEvent, screen } from '@testing-library/react';
import { aProduct } from '../../../test/fakes';
import { renderWithStore } from '../../../test/render';
import { ProductPage } from './ProductPage';

describe('ProductPage', () => {
  it('shows skeletons while products load', () => {
    renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={jest.fn()} />, { products: { status: 'loading', items: [] } });
    expect(screen.getAllByTestId('product-skeleton')).toHaveLength(3);
  });

  it('shows products with price and stock, and buys the chosen quantity', async () => {
    const onBuy = jest.fn();
    const { user } = renderWithStore(<ProductPage onBuy={onBuy} onRetry={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Aurora Wireless Headphones' })).toBeInTheDocument();
    expect(screen.getByText('5 disponibles')).toBeInTheDocument();
    expect(screen.getByText(/349\.900/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agregar una unidad' }));
    await user.click(screen.getByRole('button', { name: 'Agregar una unidad' }));
    await user.click(screen.getByRole('button', { name: 'Quitar una unidad' }));
    await user.click(screen.getByRole('button', { name: /Pagar con tarjeta/ }));
    expect(onBuy).toHaveBeenCalledWith('prod-headphones', 2);
  });

  it('limits the quantity to the stock and to five units', async () => {
    const { user } = renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={jest.fn()} />, {
      products: { items: [aProduct({ availableUnits: 2 })] },
    });
    expect(screen.getByText('¡Últimas 2 unidades!')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Agregar una unidad' });
    await user.click(add);
    expect(add).toBeDisabled();
  });

  it('uses the singular label for the last unit', () => {
    renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={jest.fn()} />, {
      products: { items: [aProduct({ availableUnits: 1 })] },
    });
    expect(screen.getByText('¡Última unidad!')).toBeInTheDocument();
  });

  it('disables buying sold out products', () => {
    renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={jest.fn()} />, {
      products: { items: [aProduct({ availableUnits: 0 })] },
    });
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin unidades' })).toBeDisabled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('shows the error with a retry button', async () => {
    const onRetry = jest.fn();
    const { user } = renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={onRetry} />, {
      products: { status: 'failed', error: 'Sin conexión', items: [] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('fades images in once loaded', () => {
    const { container } = renderWithStore(<ProductPage onBuy={jest.fn()} onRetry={jest.fn()} />);
    const img = screen.getByRole('img', { name: 'Aurora Wireless Headphones' });
    expect(img).toHaveAttribute('srcset', '/images/headphones-360.webp 360w, /images/headphones.webp 720w');
    expect(img).toHaveAttribute('loading', 'eager');
    fireEvent.load(img);
    expect(container.querySelector('[class*="loaded"]')).not.toBeNull();
  });
});
