export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  message?: string | string[];
  error?: string | { reason?: string; type?: string };
}

const readMessage = (body: ErrorBody, fallback: string): { message: string; code?: string } => {
  const code = typeof body.error === 'string' ? body.error : body.error?.type;
  const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  return { message: message ?? fallback, code };
};

export const requestJson = async <T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.', 0);
  }
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    const { message, code } = readMessage(body, 'Ocurrió un error inesperado');
    throw new ApiError(message, response.status, code);
  }
  return body;
};
