export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

type Awaitable<T> = T | PromiseLike<T>;

/**
 * Railway Oriented Programming helper.
 * Each step runs only while the result stays on the success track;
 * the first failure short-circuits the rest of the chain.
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  private constructor(private readonly promise: Promise<Result<T, E>>) {}

  static from<T, E>(result: Awaitable<Result<T, E>>): ResultAsync<T, E> {
    return new ResultAsync(Promise.resolve(result));
  }

  static ok<T, E = never>(value: T): ResultAsync<T, E> {
    return ResultAsync.from<T, E>(ok(value));
  }

  andThen<U, F>(
    fn: (value: T) => Awaitable<Result<U, F>>,
  ): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(
      this.promise.then((result) => (result.ok ? fn(result.value) : result)),
    );
  }

  map<U>(fn: (value: T) => Awaitable<U>): ResultAsync<U, E> {
    return new ResultAsync<U, E>(
      this.promise.then(async (result) =>
        result.ok ? ok(await fn(result.value)) : result,
      ),
    );
  }

  orElse<U, F>(
    fn: (error: E) => Awaitable<Result<U, F>>,
  ): ResultAsync<T | U, F> {
    return new ResultAsync<T | U, F>(
      this.promise.then((result) => (result.ok ? result : fn(result.error))),
    );
  }

  then<R1 = Result<T, E>, R2 = never>(
    onfulfilled?: ((value: Result<T, E>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.promise.then(onfulfilled, onrejected);
  }
}
