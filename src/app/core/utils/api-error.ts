export interface NormalizedApiError {
  message: string;
  status?: number;
}

export function apiErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { error?: { message?: string }; message?: string };
    return e.error?.message || e.message || fallback;
  }
  return fallback;
}

export function normalizeApiError(err: unknown, fallback = 'Request failed'): NormalizedApiError {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined;
  return {
    message: apiErrorMessage(err, fallback),
    status: Number.isFinite(status) ? status : undefined,
  };
}
