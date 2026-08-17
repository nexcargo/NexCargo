// NexCargo Base Use Case — Application layer orchestration per PROMPT 3
// Use cases coordinate between domain services and repositories without accessing DB directly.

import { CorrelationContext } from '@/shared/types/core';

export abstract class BaseUseCase {
  protected readonly useCaseName: string;

  constructor(useCaseName: string) {
    this.useCaseName = useCaseName;
  }

  /** Execute the use case with optional context */
  abstract execute(input: unknown, context?: CorrelationContext): Promise<unknown>;

  /** Validate input before execution (override in concrete implementations) */
  protected validateInput(_input: unknown): void {
    // Override in concrete use cases
  }
}
