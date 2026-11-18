// I-2 Part C item 1 / item 8 — role-resolution convention guard.
// Runs on the repository DDL only, so it is executable without owner-class database access.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'src', 'infrastructure', 'migrations');

const stripComments = (text: string) =>
  text.split('\n').map((l) => (l.includes('--') ? l.slice(0, l.indexOf('--')) : l)).join('\n');

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const all = files.map((f) => ({ f, text: stripComments(readFileSync(join(MIGRATIONS, f), 'utf8')) }));

type Block = { file: string; name: string; table: string; body: string };
const blocks: Block[] = [];
for (const x of all) {
  const re = /CREATE\s+POLICY\s+(?:"([^"]+)"|([A-Za-z_]\w*))\s+ON\s+([\w.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(x.text))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < x.text.length; i++) {
      if (x.text[i] === '(') depth++;
      else if (x.text[i] === ')') depth--;
      else if (x.text[i] === ';' && depth <= 0) break;
    }
    blocks.push({ file: x.f, name: (m[1] || m[2]).trim(), table: m[3], body: x.text.slice(m.index, i + 1) });
  }
}

// Supersessions. Explicit DROP POLICY statements carry name@table, but 046 removes the JWT convention through
// a pg_policies loop whose names appear only in its IN (...) list, so that list is read as drops-of-record too;
// without it the effective set would still count policies the live database no longer has.
const explicitDrops: { file: string; name: string; table: string }[] = [];
const loopNames = new Set<string>();
for (const x of all) {
  for (const m of x.text.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_]\w*))\s+ON\s+([\w.]+)/gi)) {
    explicitDrops.push({ file: x.f, name: (m[1] || m[2]).trim(), table: m[3] });
  }
  for (const m of x.text.matchAll(/policyname IN \(([\s\S]*?)\)\s/gi)) {
    for (const n of m[1].matchAll(/'([^']+)'/g)) loopNames.add(n[1]);
  }
}
const fileOrder = (f: string) => files.indexOf(f);
const superseded = (b: Block) =>
  loopNames.has(b.name) ||
  explicitDrops.some((d) => fileOrder(d.file) >= fileOrder(b.file) && d.name.toLowerCase() === b.name.toLowerCase() && d.table === b.table);

const effective = blocks.filter((b) => !superseded(b));
const everyPolicy = effective.map((b) => `${b.file}: ${b.body}`);
const jwtInHistory = blocks.filter((b) => /auth\.jwt\(\)/i.test(b.body)).length;

describe('I-2 item 1: one role-resolution convention in the policy set', () => {
  it('parses a non-trivial policy population, and the JWT convention really was the historical one', () => {
    expect(blocks.length).toBeGreaterThan(200);
    expect(jwtInHistory).toBe(20);
    expect(effective.length).toBeLessThan(blocks.length);
  });

  it('no effective policy resolves a role from the JWT role claim', () => {
    const offenders = everyPolicy.filter((p) => /auth\.jwt\(\)/i.test(p)).map((p) => p.slice(0, 90));
    expect(offenders).toEqual([]);
  });

  it('no policy resolves a role from user metadata', () => {
    const offenders = everyPolicy
      .filter((p) => /raw_user_meta_data|user_metadata|declared_role\s*\(\s*\)/i.test(p))
      .map((p) => p.slice(0, 90));
    expect(offenders).toEqual([]);
  });

  it('no effective policy admits a classification outside the canonical eight', () => {
    const canonical = ['SHIPPER', 'TRANSPORTER', 'DRIVER', 'DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN', 'LA'];
    const literals = new Set<string>();
    for (const p of everyPolicy) {
      for (const m of p.matchAll(/'([A-Za-z_]+)'/g)) literals.add(m[1]);
    }
    // Only lowercase role-shaped literals are a taxonomy violation; statuses and column values are not roles.
    const roleWords = ['admin', 'super_admin', 'superadmin', 'moderator', 'dispatcher', 'shipper', 'transporter', 'driver'];
    const offenders = [...literals].filter((v) => roleWords.includes(v.toLowerCase()) && !canonical.includes(v));
    expect(offenders).toEqual([]);
  });
});

describe('I-2 item 1: the tracking RPC resolves roles the way policies do', () => {
  const latest = [...all].reverse().find((x) => /CREATE OR REPLACE FUNCTION public\.atomic_tracking_status_update/i.test(x.text));

  it('exists', () => {
    expect(latest).toBeTruthy();
  });

  it('resolves through the governance-backed resolvers', () => {
    expect(latest!.text).toMatch(
      /SELECT\s+COALESCE\(public\.effective_user_role\(\),\s*public\.effective_marketplace_role\(\)\)\s+INTO\s+v_role/i);
  });

  it('no longer resolves the caller role with an inline platform_roles query', () => {
    const body = /AS \$(?:[^$]*)\$\$/i.exec(latest!.text)?.[0] ?? '';
    expect(/FROM\s+app\.platform_roles\s+pr\s+WHERE\s+pr\.user_id\s*=\s*v_caller/i.test(body)).toBe(false);
  });

  it('restates the search_path pin that CREATE OR REPLACE would otherwise drop', () => {
    const head = /CREATE OR REPLACE FUNCTION public\.atomic_tracking_status_update[\s\S]*?AS \$/i.exec(latest!.text)?.[0] ?? '';
    // Both spellings pin the identical search_path (proconfig search_path=pg_catalog, public): the
    // hand-written `= pg_catalog, public` and the canonical pg_get_functiondef form
    // `TO 'pg_catalog', 'public'` used by migrations 065/066. The security property asserted here is
    // that the pin is restated, not which equivalent spelling the latest migration happens to use.
    expect(head).toMatch(/SET search_path (?:=\s*pg_catalog,\s*public|TO\s+'pg_catalog',\s*'public')/i);
    expect(head).toMatch(/SECURITY DEFINER/i);
  });
});
