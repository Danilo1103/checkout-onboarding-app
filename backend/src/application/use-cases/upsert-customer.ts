import { Customer } from '../../domain/customer';
import { DomainError, validationError } from '../../domain/shared/errors';
import { err, ok, ResultAsync } from '../../domain/shared/result';
import { validateEmail, validatePhone } from '../../domain/validation';
import { CustomerRepository } from '../ports/repositories';

export const validateCustomer = (input: Customer) => {
  const customer: Customer = {
    email: (input.email ?? '').trim().toLowerCase(),
    fullName: (input.fullName ?? '').trim(),
    phone: (input.phone ?? '').trim(),
  };
  const errors = [
    ...validateEmail(customer.email),
    ...validatePhone(customer.phone),
  ];
  if (!customer.fullName) errors.push('fullName is required');
  return errors.length === 0
    ? ok(customer)
    : err(validationError('Invalid customer', errors));
};

export class UpsertCustomer {
  constructor(private readonly customers: CustomerRepository) {}

  execute(customer: Customer): ResultAsync<Customer, DomainError> {
    return ResultAsync.from(validateCustomer(customer)).map((valid) =>
      this.customers.upsert(valid),
    );
  }
}
