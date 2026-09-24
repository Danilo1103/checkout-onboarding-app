export interface CustomerInput {
  email: string;
  fullName: string;
  phone: string;
}

export interface ShippingInput {
  recipient: string;
  phone: string;
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{7,15}$/;
const POSTAL = /^\d{4,10}$/;

export const validateCustomer = (customer: CustomerInput): FieldErrors<CustomerInput> => {
  const errors: FieldErrors<CustomerInput> = {};
  if (!EMAIL.test(customer.email.trim())) errors.email = 'Correo inválido';
  if (customer.fullName.trim().length < 3) errors.fullName = 'Escribe tu nombre completo';
  if (!PHONE.test(customer.phone.trim())) errors.phone = 'Teléfono de 7 a 15 dígitos';
  return errors;
};

export const validateShipping = (shipping: ShippingInput): FieldErrors<ShippingInput> => {
  const errors: FieldErrors<ShippingInput> = {};
  if (shipping.recipient.trim().length < 3) errors.recipient = 'Escribe quién recibe';
  if (!PHONE.test(shipping.phone.trim())) errors.phone = 'Teléfono de 7 a 15 dígitos';
  if (shipping.addressLine.trim().length < 5) errors.addressLine = 'Escribe la dirección completa';
  if (!shipping.city.trim()) errors.city = 'Escribe la ciudad';
  if (!shipping.region.trim()) errors.region = 'Escribe el departamento';
  if (!POSTAL.test(shipping.postalCode.trim())) errors.postalCode = 'Código postal de 4 a 10 dígitos';
  return errors;
};
