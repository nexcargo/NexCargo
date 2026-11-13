// I-2 Part C item 4 / item 8 — service-role privilege minimum guard.
// The live measurement is in the register row; this file guards the repository half:
// that the revocation is recorded, that nothing re-grants it, and that the definer
// path which replaces it is still described correctly. Runs on repository text only,
// so it is executable without owner-class database access.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'src', 'infrastructure', 'migrations');
const stripComments = (text: string) =>
  text.split('\n').map((l) => (l.includes('--') ? l.slice(0, l.indexOf('--')) : l)).join('\n');

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const all = files.map((f) => ({ f, text: stripComments(readFileSync(join(MIGRATIONS, f), 'utf8')) }));
const order = (f: string) => files.indexOf(f);

const ITEM4 = '054_i2_service_role_privilege_minimum.sql';
const APP_OBJECTS = [
  'app.marketplace_memberships',
  'app.operational_delegations',
  'app.operational_delegation_audit',
  'app.operational_delegation_audit_seq',
];

const revokeStatements = (text: string) =>
  [...text.matchAll(/REVOKE\s+(ALL|[\s,]+A-Z\w*)\s+ON\s+(?:TABLE\s+|SEQUENCE\s+)?([a-z_]+\.[a-z_]+)\s+FROM\s+service_role\s*;/gi)]
    .map((m) => m[2]);

describe('I-2 item 4: the service-role table-privilege minimum is recorded', () => {
  const item4 = all.find((x) => x.f === ITEM4);

  it('the migration exists and revokes exactly the four measured app objects', () => {
    expect(item4).toBeTruthy();
    expect(revokeStatements(item4!.text).sort()).toEqual([...APP_OBJECTS].sort());
  });

  it('it revokes from service_role only — no client role loses access it depends on', () => {
    const roles = new Set(
      [...item4!.text.matchAll(/REVOKE\s+[^;]+FROM\s+([a-z_,\s]+);/gi)].flatMap((m) =>
        m[1].split(',').map((r) => r.trim()),
      ),
    );
    expect([...roles]).toEqual(['service_role']);
  });

  it('it states the premise that makes the revocation zero-delta, and does not grant anything', () => {
    expect(item4!.text).toMatch(/has_schema_privilege\('service_role'::regrole,\s*'app',\s*'USAGE'\)/i);
    // Statement-anchored: the guard's own RAISE EXCEPTION messages quote the privileges being
    // removed, and those string literals are not grants.
    expect(item4!.text).not.toMatch(/(?:^|[;])\s*GRANT\s+[^;]*TO\s+[^;]*service_role\s*;/im);
  });
});

describe('I-2 item 4: nothing in the corpus silently re-widens it', () => {
  it('no migration at or after 054 grants service_role a table or sequence privilege inside app', () => {
    const offenders = all
      .filter((x) => x.f !== ITEM4 && order(x.f) >= order(ITEM4))
      .flatMap((x) =>
        [...x.text.matchAll(/GRANT\s+[^;]+ON\s+(?:TABLE\s+|SEQUENCE\s+)?(app\.[a-z_]+)\s+TO\s+[^;]*service_role[^;]*;/gi)]
          .map((m) => `${x.f}: ${m[1]}`),
      );
    expect(offenders).toEqual([]);
  });

  it('no migration ever grants service_role USAGE on schema app, which is what made those grants unreachable', () => {
    const offenders = all
      .filter((x) => /GRANT\s+[^;]*USAGE[^;]*ON\s+SCHEMA\s+app\s+TO\s+[^;]*service_role/i.test(x.text))
      .map((x) => x.f);
    expect(offenders).toEqual([]);
  });

  it('the write path that replaces the grants is still definer-based in the corpus', () => {
    // record_marketplace_membership plus the two delegation RPCs must be SECURITY DEFINER,
    // pinned, and EXECUTE-able by service_role — otherwise the revoked table privileges would
    // have been load-bearing and 054's guard is describing a path that no longer exists.
    for (const fn of [
      'public.record_marketplace_membership',
      'public.grant_operational_delegation',
      'public.revoke_operational_delegation',
    ]) {
      const creator = [...all].reverse().find((x) =>
        new RegExp(`CREATE OR REPLACE FUNCTION ${fn}\\(`, 'i').test(x.text),
      );
      expect(creator, fn).toBeTruthy();
      const head = new RegExp(
        `CREATE OR REPLACE FUNCTION ${fn}\\([\\s\\S]{0,1200}?\\bAS\\b`,
        'i',
      ).exec(creator!.text)?.[0] ?? '';
      expect(head, `${fn} must stay SECURITY DEFINER and pinned`).toMatch(/SECURITY DEFINER/i);
      expect(head, `${fn} must stay pinned`).toMatch(/SET search_path = pg_catalog, public/i);
      const grant = new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}[^;]*TO[^;]*service_role`, 'i');
      const revoke = new RegExp(`REVOKE[^;]*ON FUNCTION ${fn}[^;]*FROM[^;]*service_role`, 'i');
      expect(
        all.some((x) => grant.test(x.text)) && !all.some((x) => revoke.test(x.text) && order(x.f) >= order(creator!.f)),
        `${fn} must remain EXECUTE-able by service_role`,
      ).toBe(true);
    }
  });
});

describe('I-2 item 4: the application depends on the definer path, not on table privileges', () => {
  const SRC = join(process.cwd(), 'src');
  const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

  it('the one membership writer call site is an RPC call', () => {
    expect(read('app/api/auth/register/route.ts')).toMatch(
      /admin\.rpc\(\s*'record_marketplace_membership'/,
    );
  });

  it('no application source names the delegation or membership tables as a query target', () => {
    // Comments explaining the tables are expected; .from(...) / .schema('app') usage would be a
    // direct write that Item 4 just proved unreachable, and would silently depend on them again.
    const offenders: string[] = [];
    for (const rel of [
      'app/api/auth/register/route.ts',
      'lib/supabase/api-auth.ts',
      'lib/supabase/get-user.ts',
      'lib/auth/role-authority.ts',
      'modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository.ts',
    ]) {
      const text = read(rel);
      if (/\.from\(\s*['"](marketplace_memberships|operational_delegations|operational_delegation_audit)['"]/.test(text)) {
        offenders.push(rel);
      }
      if (/\.schema\(\s*['"]app['"]/.test(text)) offenders.push(`${rel}: schema('app')`);
    }
    expect(offenders).toEqual([]);
  });
});
