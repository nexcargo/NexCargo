// NexCargo Base Service — Foundation for domain services per PROMPT 1
// Provides common service infrastructure including error handling and logging hooks.

import { CorrelationContext } from '@/shared/types/core';
import { AppError, ErrorCode } from '@/shared/errors/app-errors';

export abstract class BaseService {
  protected readonly moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  /** Generate correlation context for distributed tracing */
  protected createContext(userId?: string, traceId?: string): CorrelationContext {
    return {
      correlationId: crypto.randomUUID(),
      traceId: traceId || crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      userId,
      moduleId: this.moduleName,
      timestamp: new Date().toISOString(),
    };
  }

  /** Log info message (hook for MOD-017 observability) */
  protected logInfo(message: string, context: CorrelationContext): void {
    console.log(`[INFO][${this.moduleName}] ${message}`, context);
  }

  /** Log warning message */
  protected logWarning(message: string, context: CorrelationContext): void {
    console.warn(`[WARNING][${this.moduleName}] ${message}`, context);
  }

  /** Log error message */
  protected logError(message: string, context: CorrelationContext, error?: Error): void {
    console.error(`[ERROR][${this.moduleName}] ${message}`, context, error);
  }

  /** Throw standardized application error */
  protected throwAppError(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): never {
    throw new AppError(code, message, details);
  }
}
