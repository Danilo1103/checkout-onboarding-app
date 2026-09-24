import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '../../application/ports/system';

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
