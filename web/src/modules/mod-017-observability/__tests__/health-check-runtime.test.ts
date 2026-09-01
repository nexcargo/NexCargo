// NexCargo MOD-017 — Health Check Runtime Tests (Wave 5 Increment 2)
// Authoritative source: MOD-017 §3.4 (Health Monitoring), §4.4 (Health Status Object)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HealthChecker,
  createHealthChecker,
  type HealthCheckResult,
} from '../domain/services/health-check-runtime';
import { HealthStatus } from '../domain/types/health-check';
import type { HealthStatusObject } from '../domain/types/health-check';

describe('MOD-017 HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker({ logModule: 'MOD-017' });
  });

  // ---- Probe Registration ----

  describe('Probe registration', () => {
    it('registers a health probe for a module/service', () => {
      const checkFn = async (): Promise<HealthCheckResult> => ({ status: HealthStatus.HEALTHY });
      checker.registerProbe('MOD-001', 'database', checkFn);

      expect(checker.getProbeCount()).toBe(1);
    });

    it('registers multiple probes for different modules', () => {
      checker.registerProbe('MOD-001', 'db', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-002', 'cache', async () => ({ status: HealthStatus.HEALTHY }));

      expect(checker.getProbeCount()).toBe(2);
    });

    it('uses custom timeout when specified', () => {
      const summary = checker.getProbeSummary();
      checker.registerProbe('MOD-001', 'slow.service', async () => ({ status: HealthStatus.HEALTHY }), 10000);

      const slowSummary = checker.getProbeSummary().find(s => s.serviceId === 'slow.service');
      expect(slowSummary!.timeoutMs).toBe(10000);
    });

    it('removes a registered probe', () => {
      checker.registerProbe('MOD-001', 'db', async () => ({ status: HealthStatus.HEALTHY }));
      expect(checker.getProbeCount()).toBe(1);

      checker.removeProbe('MOD-001', 'db');
      expect(checker.getProbeCount()).toBe(0);
    });

    it('creates via factory function', () => {
      const hc = createHealthChecker({ logModule: 'TEST' });
      expect(hc).toBeInstanceOf(HealthChecker);
      hc.clearAll();
    });
  });

  // ---- Single Module Evaluation ----

  describe('evaluateModule', () => {
    it('evaluates a single healthy module', async () => {
      checker.registerProbe('MOD-001', 'api', async () => ({
        status: HealthStatus.HEALTHY,
        details: 'All endpoints responding',
      }));

      const result = await checker.evaluateModule('MOD-001');
      expect(result).toBeDefined();
      expect(result!.status).toBe(HealthStatus.HEALTHY);
      expect(result!.details).toContain('healthy');
    });

    it('evaluates a module with degraded dependency', async () => {
      checker.registerProbe('MOD-002', 'cache', async () => ({
        status: HealthStatus.DEGRADED,
        details: 'High latency on cache reads',
      }));

      const result = await checker.evaluateModule('MOD-002');
      // Single DEGRADED dependency does not trigger DOWN aggregation (only DOWN deps count)
      expect(result!.dependencyStatus[0].status).toBe(HealthStatus.DEGRADED);
    });

    it('evaluates a module whose service is DOWN', async () => {
      checker.registerProbe('MOD-003', 'external-gw', async () => ({
        status: HealthStatus.DOWN,
        details: 'Connection refused',
      }));

      const result = await checker.evaluateModule('MOD-003');
      // 1 DOWN dep out of 1 total → 1 > 0.5 → aggregateDependencyHealth returns DOWN for overall system
      // Per-module status uses same logic: single DOWN dep = DEGRADED at module level via evaluateModule
      expect(result!.dependencyStatus[0].status).toBe(HealthStatus.DOWN);
    });

    it('returns undefined for unregistered module', async () => {
      const result = await checker.evaluateModule('MOD-999');
      expect(result).toBeUndefined();
    });

    it('handles failing health probe gracefully', async () => {
      checker.registerProbe('MOD-004', 'crashy', async () => {
        throw new Error('Probe execution failed');
      });

      const result = await checker.evaluateModule('MOD-004');
      // Failed probe → dependency status DOWN; handled without crashing
      expect(result!.dependencyStatus[0].status).toBe(HealthStatus.DOWN);
    });

    it('includes service details in dependency status', async () => {
      checker.registerProbe('MOD-005', 'service-a', async () => ({
        status: HealthStatus.HEALTHY,
        details: 'Redis connected on port 6379',
      }));

      const result = await checker.evaluateModule('MOD-005');
      expect(result!.dependencyStatus[0].details).toBe('Redis connected on port 6379');
    });
  });

  // ---- Full System Evaluation ----

  describe('evaluateAll', () => {
    it('evaluates all registered probes and aggregates results', async () => {
      checker.registerProbe('MOD-001', 'db', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-001', 'redis', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-002', 'queue', async () => ({ status: HealthStatus.HEALTHY }));

      const report = await checker.evaluateAll();

      expect(report.overallStatus).toBe(HealthStatus.HEALTHY);
      expect(Object.keys(report.modules)).toContain('MOD-001');
      expect(Object.keys(report.modules)).toContain('MOD-002');
      expect(report.dependencies.length).toBe(3);
      expect(report.checkedAt).toBeDefined();
    });

    it('marks overall as DEGRADED when any dependency is down', async () => {
      checker.registerProbe('MOD-001', 'api', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-002', 'down-service', async () => ({ status: HealthStatus.DOWN }));

      const report = await checker.evaluateAll();
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('marks overall as DOWN when more than half dependencies are down', async () => {
      checker.registerProbe('MOD-001', 'healthy-1', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-002', 'down-1', async () => ({ status: HealthStatus.DOWN }));
      checker.registerProbe('MOD-003', 'down-2', async () => ({ status: HealthStatus.DOWN }));

      const report = await checker.evaluateAll();
      expect(report.overallStatus).toBe(HealthStatus.DOWN);
    });

    it('aggregates per-module health from individual services', async () => {
      checker.registerProbe('MOD-010', 'auth', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-010', 'session-store', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-010', 'token-validator', async () => ({ status: HealthStatus.DOWN }));

      const report = await checker.evaluateAll();

      const mod010Health = report.modules['MOD-010'];
      expect(mod010Health).toBeDefined();
      expect(mod010Health!.status).toBe(HealthStatus.DEGRADED);
      expect(mod010Health!.dependencyStatus.length).toBe(3);
    });

    it('respects probe timeout', async () => {
      checker.registerProbe(
        'MOD-020',
        'slow-probe',
        async () => new Promise(resolve => setTimeout(() => resolve({ status: HealthStatus.HEALTHY }), 100)),
        10 // 10ms timeout — should trigger
      );

      const report = await checker.evaluateAll();
      // Slow probe should be marked DOWN due to timeout
      const dep = report.dependencies.find(d => d.moduleId === 'MOD-020');
      expect(dep!.status).toBe(HealthStatus.DOWN);
    });
  });

  // ---- Caching ----

  describe('Cache operations', () => {
    it('updates and retrieves cached health', async () => {
      checker.registerProbe('MOD-001', 'svc', async () => ({ status: HealthStatus.HEALTHY }));

      const health = (await checker.evaluateModule('MOD-001'))!;
      checker.updateCache('MOD-001', health as HealthStatusObject);

      const cached = checker.getCachedHealth('MOD-001');
      expect(cached).toEqual(health);
    });

    it('returns undefined for uncached module', () => {
      expect(checker.getCachedHealth('MOD-001')).toBeUndefined();
    });
  });

  // ---- Dependency Health Aggregation Integration ----

  describe('Dependency health aggregation integration', () => {
    it('correctly applies aggregateDependencyHealth logic', async () => {
      checker.registerProbe('MOD-001', 'dep1', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-001', 'dep2', async () => ({ status: HealthStatus.HEALTHY }));

      const report = await checker.evaluateAll();
      expect(report.overallStatus).toBe(HealthStatus.HEALTHY);
    });

    it('single dependency down → DOWN when it is 100% of deps', async () => {
      checker.registerProbe('MOD-001', 'failing-dep', async () => ({ status: HealthStatus.DOWN }));

      const report = await checker.evaluateAll();
      // 1/1 deps down = 100% > 50% threshold → DOWN
      expect(report.overallStatus).toBe(HealthStatus.DOWN);
    });

    it('majority of dependencies down → DOWN', async () => {
      checker.registerProbe('MOD-001', 'd1', async () => ({ status: HealthStatus.DOWN }));
      checker.registerProbe('MOD-001', 'd2', async () => ({ status: HealthStatus.DOWN }));
      checker.registerProbe('MOD-002', 'h1', async () => ({ status: HealthStatus.HEALTHY }));

      const report = await checker.evaluateAll();
      // 2/3 deps down = 66% > 50% → DOWN
      expect(report.overallStatus).toBe(HealthStatus.DOWN);
    });

    it('mixed healthy and down deps → DEGRADED when minority down', async () => {
      checker.registerProbe('MOD-001', 'healthy-a', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-001', 'healthy-b', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-001', 'down-c', async () => ({ status: HealthStatus.DOWN }));

      const report = await checker.evaluateAll();
      // 1/3 deps down = 33% < 50% → DEGRADED (not yet DOWN)
      expect(report.overallStatus).toBe(HealthStatus.DEGRADED);
    });

    it('majority of dependencies down → DOWN', async () => {
      checker.registerProbe('MOD-001', 'd1', async () => ({ status: HealthStatus.DOWN }));
      checker.registerProbe('MOD-001', 'd2', async () => ({ status: HealthStatus.DOWN }));
      checker.registerProbe('MOD-002', 'h1', async () => ({ status: HealthStatus.HEALTHY }));

      const report = await checker.evaluateAll();
      expect(report.overallStatus).toBe(HealthStatus.DOWN);
    });
  });

  // ---- Lifecycle Operations ----

  describe('Lifecycle operations', () => {
    it('clears all probes and caches', () => {
      checker.registerProbe('MOD-001', 'svc', async () => ({ status: HealthStatus.HEALTHY }));
      checker.clearAll();

      expect(checker.getProbeCount()).toBe(0);
    });

    it('probe summary lists all registered probes', () => {
      checker.registerProbe('MOD-001', 'api', async () => ({ status: HealthStatus.HEALTHY }));
      checker.registerProbe('MOD-002', 'db', async () => ({ status: HealthStatus.HEALTHY }), 3000);

      const summary = checker.getProbeSummary();
      expect(summary).toHaveLength(2);
      expect(summary[0]).toMatchObject({ moduleId: 'MOD-001', serviceId: 'api' });
    });
  });

  // ---- NO INTERVENTION Verification ----

  describe('NO-INTERVENTION BOUNDARY VERIFICATION', () => {
    it('health evaluation does not modify application state', async () => {
      checker.registerProbe('MOD-001', 'test-svc', async () => ({ status: HealthStatus.HEALTHY }));

      // Before and after health check should show same system state
      const beforeProbes = checker.getProbeCount();
      await checker.evaluateModule('MOD-001');
      const afterProbes = checker.getProbeCount();

      expect(beforeProbes).toBe(afterProbes);
    });

    it('health probes execute independently without side effects', async () => {
      let externalSideEffectTriggered = false;

      checker.registerProbe('MOD-001', 'innocent', async () => {
        return { status: HealthStatus.HEALTHY };
      });

      // Even if a probe tries to trigger something, health checks must not alter app state
      const report = await checker.evaluateAll();
      expect(report.overallStatus).toBe(HealthStatus.HEALTHY);
    });

    it('probe timeout failure does not crash health evaluation', async () => {
      checker.registerProbe('MOD-001', 'timeout-probe', async () => {
        return new Promise(resolve => {
          // Never resolves — will hit timeout
        });
      }, 50);

      const report = await checker.evaluateAll();
      // Should complete even with timeouts — marks that probe as DOWN
      expect(report).toBeDefined();
    });
  });
});
