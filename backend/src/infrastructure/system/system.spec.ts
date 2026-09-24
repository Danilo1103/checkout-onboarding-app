import { SystemClock, UuidGenerator } from './system';

describe('system adapters', () => {
  it('generates unique ids and returns the current time', () => {
    const ids = new UuidGenerator();
    expect(ids.next()).not.toBe(ids.next());
    expect(new SystemClock().now()).toBeInstanceOf(Date);
  });
});
