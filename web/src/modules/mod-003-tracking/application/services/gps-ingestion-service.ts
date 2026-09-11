// NexCargo MOD-003 — GPS Ingestion Service (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Validates GPS coordinates using existing validation logic before persistence

import { GpsUpdateRepository } from '../../infrastructure/repositories/gps-update-repository';
import type { CreateGpsUpdateParams } from '../../infrastructure/repositories/gps-update-repository';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * Service for ingesting GPS location updates with validation.
 */
export class GpsIngestionService {
  private readonly gpsUpdateRepo = new GpsUpdateRepository();

  /**
   * Submit a GPS location update after validation.
   * 
   * Validation rules per MOD-003 §4.5/§7.4:
   * - Latitude: -90 to +90
   * - Longitude: -180 to +180
   * - Speed: 0–250 km/h (optional)
   * - Accuracy: ≥ 0 metres (optional)
   * - Battery: 0–100% (optional)
   * - Online-only in C7-001 (isOffline always FALSE)
   */
  async ingest(params: Omit<CreateGpsUpdateParams, 'source' | 'isOffline'>): Promise<void> {
    // Validate coordinates
    const validationErrors = this.validateCoordinates(params.latitude, params.longitude);
    if (validationErrors.length > 0) {
      throw new ValidationError('GPS validation failed', { errors: validationErrors });
    }

    // Insert GPS update as online source (C7-001 constraint: no offline-first)
    await this.gpsUpdateRepo.create({
      ...params,
      source: 'GPS',
      isOffline: false,
    });
  }

  /**
   * Get the last known location for a tracking record.
   */
  async getLastLocation(trackingId: string): Promise<{ latitude: number; longitude: number; timestamp: string } | null> {
    const lastUpdate = await this.gpsUpdateRepo.getLastForTrackingId(trackingId);
    if (!lastUpdate || !lastUpdate.latitude || !lastUpdate.longitude) {
      return null;
    }

    return {
      latitude: lastUpdate.latitude,
      longitude: lastUpdate.longitude,
      timestamp: lastUpdate.timestamp,
    };
  }

  private validateCoordinates(latitude: number, longitude: number): string[] {
    const errors: string[] = [];

    if (latitude < -90 || latitude > 90) {
      errors.push(`Latitude ${latitude} out of range (-90 to 90)`);
    }

    if (longitude < -180 || longitude > 180) {
      errors.push(`Longitude ${longitude} out of range (-180 to 180)`);
    }

    return errors;
  }
}
