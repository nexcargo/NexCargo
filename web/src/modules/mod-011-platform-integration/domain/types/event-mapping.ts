// NexCargo MOD-011 Domain Types — Event Mapping Layer Foundation
// Authoritative source: MOD-011 §4.4 (Event Mapping Object)
// Implements exit criteria X-03: Event Mapping Object with transformation rules and delivery guarantee levels

/**
 * Delivery guarantee level enum per MOD-011 §4.4
 */
export enum DeliveryGuaranteeLevel {
  AT_LEAST_ONCE = 'AT_LEAST_ONCE',
  EXACTLY_ONCE = 'EXACTLY_ONCE',
  BEST_EFFORT = 'BEST_EFFORT',
}

/**
 * Event Mapping Object — represents internal ↔ external event translation.
 * Per MOD-011 §4.4.
 */
export interface EventMappingObject {
  // Core attributes from MOD-011 §4.4
  mappingId: string;           // UUID v4
  internalEventType: string;   // camelCase per Event Registry conventions
  externalEventType: string;   // External system event name
  transformationRules: Record<string, unknown>; // Structured JSON transformation rules
  targetSystem: string;        // Target external system identifier
  deliveryGuaranteeLevel: DeliveryGuaranteeLevel;
}

/**
 * Creates a new event mapping configuration.
 * @param params - Partial event mapping parameters
 * @returns Complete EventMappingObject with generated ID
 */
export function createEventMapping(params: Partial<EventMappingObject>): EventMappingObject {
  return {
    mappingId: crypto.randomUUID(),
    ...params,
  } as EventMappingObject;
}
