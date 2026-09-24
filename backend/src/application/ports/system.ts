import { Fees } from '../../domain/pricing';

export const ID_GENERATOR = Symbol('IdGenerator');
export const CLOCK = Symbol('Clock');
export const CHECKOUT_FEES = Symbol('CheckoutFees');

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): Date;
}

export type CheckoutFees = Fees;
