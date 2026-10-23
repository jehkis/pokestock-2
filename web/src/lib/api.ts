export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, opts: RequestInit = {}, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...headers } });
  let body: any = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) throw new ApiError(body?.virhe || `Virhe (${res.status})`, res.status);
  return body as T;
}
