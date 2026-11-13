// NexCargo I-5 §3F — the one fetch helper the Transporter quotation screens use.
// Like callFleetApi it goes through the existing REST route rather than a Server Action, so session
// authentication, the MOD-010 RBAC matrix and the offers RLS policies stay in the implementation that
// already enforces them. The marketplace envelope wraps business rejections in data.error and authorization
// denials in a top-level message, so both shapes are read here.

export async function callMarketplaceApi(
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    data?: { error?: string };
  } | null;

  if (!response.ok) {
    throw new Error(payload?.data?.error ?? payload?.message ?? `HTTP ${response.status}`);
  }

  return (payload?.data as Record<string, unknown> | undefined) ?? null;
}
