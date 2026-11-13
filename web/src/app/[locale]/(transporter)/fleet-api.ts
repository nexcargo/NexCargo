// NexCargo I-5 §3C/§3D — the one fetch helper the Transporter fleet screens use.
// Every mutation goes through the existing MOD-014 REST routes with same-origin credentials, so session
// authentication, RBAC and ownership stay in the one implementation that already enforces them. The
// failure path matters as much as the success path: the fleet envelope carries error.message, and that text
// is what the Transporter sees, because it already names the governed reason (missing field, unknown
// lifecycle value, or a reference outside this session).

export async function callFleetApi(
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string } | string;
    data?: { error?: string };
  } | null;

  if (!response.ok) {
    const fromEnvelope = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
    throw new Error(fromEnvelope ?? payload?.data?.error ?? `HTTP ${response.status}`);
  }
}
