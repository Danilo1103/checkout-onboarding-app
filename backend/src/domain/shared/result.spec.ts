import { err, ok, ResultAsync } from './result';

describe('ResultAsync', () => {
  it('runs every step while on the success track', async () => {
    const result = await ResultAsync.ok<number, string>(2)
      .andThen((n) => ok(n * 3))
      .map(async (n) => n + 1);
    expect(result).toEqual(ok(7));
  });

  it('short-circuits on the first failure', async () => {
    const skipped = jest.fn();
    const result = await ResultAsync.from<number, string>(err('boom'))
      .andThen(skipped)
      .map(skipped);
    expect(result).toEqual(err('boom'));
    expect(skipped).not.toHaveBeenCalled();
  });

  it('accepts promises and other ResultAsync values as steps', async () => {
    const result = await ResultAsync.from(Promise.resolve(ok(1))).andThen((n) =>
      ResultAsync.ok(n + 1),
    );
    expect(result).toEqual(ok(2));
  });

  it('recovers from failures with orElse', async () => {
    const recovered = await ResultAsync.from<number, string>(
      err('boom'),
    ).orElse(() => ok(0));
    const untouched = await ResultAsync.ok<number, string>(5).orElse(() =>
      ok(0),
    );
    expect(recovered).toEqual(ok(0));
    expect(untouched).toEqual(ok(5));
  });
});
