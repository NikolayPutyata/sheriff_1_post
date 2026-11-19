import { tg } from './telegram';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const DEV_USER_KEY = 'dev-user-id';

/** Лише для розробки поза Telegram: від чийого імені працюємо (сервер з DEV_AUTH=true). */
export function getDevUserId(): string {
  try {
    return localStorage.getItem(DEV_USER_KEY) ?? '1000';
  } catch {
    return '1000';
  }
}
export function setDevUserId(id: string) {
  try {
    localStorage.setItem(DEV_USER_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Адреса API: на Vercel — VITE_API_URL (сервер Хелпера), локально — проксі Vite. */
const API_BASE = (import.meta.env.VITE_API_URL || '/api/journal').replace(/\/+$/, '');

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (tg?.initData) headers.authorization = `tma ${tg.initData}`;
  else if (import.meta.env.DEV) headers['x-dev-user-id'] = getDevUserId();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, `Немає зʼєднання з сервером (${API_BASE}). Перевірте інтернет і спробуйте ще раз.`);
  }
  // не JSON — запит пішов не на сервер журналу (напр. не задано VITE_API_URL на Vercel)
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiError(
      res.status,
      `Сервер журналу недоступний (запит на ${API_BASE}${path}, HTTP ${res.status}). Перевірте змінну VITE_API_URL на Vercel і зробіть Redeploy.`,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Помилка сервера (${res.status})`, data?.code);
  return data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Невідома помилка';
}
