export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, opts: RequestInit = {}, headers: Record<string, string> = {}): Promise<T> {
  // FormData (kuvan lataus): selain asettaa Content-Typen rajoineen itse
  const json = !(opts.body instanceof FormData);
  const res = await fetch(path, { ...opts, headers: { ...(json && { 'Content-Type': 'application/json' }), ...headers } });
  let body: any = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) throw new ApiError(body?.virhe || `Virhe (${res.status})`, res.status);
  return body as T;
}
