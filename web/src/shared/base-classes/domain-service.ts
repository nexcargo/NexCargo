// NexCargo Domain Service — For services that operate purely within domain boundaries per PROMPT 3
// Domain services have NO external dependencies (no DB, no API calls, no HTTP).

import { BaseService } from './base-service';

export abstract class DomainService extends BaseService {
  /**
   * Execute domain logic without side effects.
   * Domain services must be pure functions where possible.
   */
  abstract execute(...args: unknown[]): Promise<unknown> | unknown;
}
