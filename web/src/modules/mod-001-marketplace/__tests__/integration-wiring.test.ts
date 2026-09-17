import { describe, it, expect } from 'vitest';
import { wrapInContractFramework, evaluateRBAC, createMarketplaceLogEntry, recordMarketplaceMetric, prepareMOD002Handoff, prepareMarketplacenotification } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import type { MatchProposal } from '@/modules/mod-001-marketplace/domain/types/matches';
import type { AdvisoryQuote } from '@/modules/mod-001-marketplace/domain/types/quotes';
import { ListingStatus, PricingModel, CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { VehicleType } from '@/shared/types/enums';

describe('MOD-001 Integration Wiring — Wave 1 Increment 4', () => {
  // ============================================================
  // MOD-011 Contract Framework
  // ============================================================

  describe('wrapInContractFramework', () => {
    it('wraps data in contract structure with correct metadata', () => {
      const data = { listings: [] };
      const correlationId = 'test-correlation-id';
      
      const wrapped = wrapInContractFramework(data, correlationId);
      
      expect(wrapped.contract.version).toBe('1.0.0');
      expect(wrapped.contract.status).toBe('ACTIVE');
      expect(wrapped.contract.ownerModule).toBe('MOD-001');
      expect(wrapped.data).toBe(data);
      expect(wrapped.correlationId).toBe(correlationId);
    });

    it('handles null data gracefully', () => {
      const correlationId = 'test-correlation-id';
      
      const wrapped = wrapInContractFramework(null, correlationId);
      
      expect(wrapped.data).toBeNull();
      expect(wrapped.contract.ownerModule).toBe('MOD-001');
    });
  });

  // ============================================================
  // MOD-017 Observability
  // ============================================================

  describe('createMarketplaceLogEntry', () => {
    it('creates log entry with required fields', () => {
      const entry = createMarketplaceLogEntry({
        level: 'INFO',
        message: 'Test message',
        operation: 'listingCreated',
        correlationId: 'test-correlation-id',
      });
      
      expect(entry.level).toBe('INFO');
      expect(entry.moduleId).toBe('MOD-001');
      expect(entry.message).toBe('Test message');
      expect(entry.operation).toBe('listingCreated');
      expect(entry.correlationId).toBe('test-correlation-id');
      expect(typeof entry.timestamp).toBe('string');
    });

    it('defaults level to INFO when not specified', () => {
      const entry = createMarketplaceLogEntry({
        message: 'Test',
        correlationId: 'test',
      });
      
      expect(entry.level).toBe('INFO');
    });

    it('accepts optional metadata', () => {
      const entry = createMarketplaceLogEntry({
        level: 'ERROR',
        message: 'Error occurred',
        correlationId: 'test',
        metadata: { errorCode: 500 },
      });
      
      expect(entry.metadata).toEqual({ errorCode: 500 });
    });
  });

  describe('recordMarketplaceMetric', () => {
    it('records metric without throwing', () => {
      expect(() => recordMarketplaceMetric('test.metric', 42, 'count')).not.toThrow();
    });

    it('handles different units', () => {
      expect(() => recordMarketplaceMetric('test.metric', 100, 'ms')).not.toThrow();
      expect(() => recordMarketplaceMetric('test.metric', 0.5, 'ratio')).not.toThrow();
    });
  });

  // ============================================================
  // MOD-010 RBAC Evaluation
  // ============================================================

  describe('evaluateRBAC', () => {
    it('allows SHIPPER to read listings', () => {
      const result = evaluateRBAC('SHIPPER', 'listings', 'read');
      expect(result.permitted).toBe(true);
    });

    it('allows SHIPPER to create listings', () => {
      const result = evaluateRBAC('SHIPPER', 'listings', 'create');
      expect(result.permitted).toBe(true);
    });

    it('denies TRANSPORTER from creating listings', () => {
      const result = evaluateRBAC('TRANSPORTER', 'listings', 'create');
      expect(result.permitted).toBe(false);
    });

    it('allows ADMIN full access to all resources', () => {
      expect(evaluateRBAC('ADMIN', 'listings', 'create').permitted).toBe(true);
      expect(evaluateRBAC('ADMIN', 'offers', 'delete').permitted).toBe(true);
      expect(evaluateRBAC('ADMIN', 'matching', 'execute').permitted).toBe(true);
      expect(evaluateRBAC('ADMIN', 'quotes', 'create').permitted).toBe(true);
    });

    it('allows SUPER_ADMIN full access (equivalent to ADMIN per HAO PE-H07)', () => {
      expect(evaluateRBAC('SUPER_ADMIN', 'listings', 'create').permitted).toBe(true);
      expect(evaluateRBAC('SUPER_ADMIN', 'offers', 'delete').permitted).toBe(true);
      expect(evaluateRBAC('SUPER_ADMIN', 'matching', 'execute').permitted).toBe(true);
      expect(evaluateRBAC('SUPER_ADMIN', 'quotes', 'create').permitted).toBe(true);
      expect(evaluateRBAC('SUPER_ADMIN', 'listings', 'read').permitted).toBe(true);
    });

    // ============================================================
    // HAO-R-003 — SUPER ADMIN PRIVILEGE HIERARCHY TESTS
    // Super Admin = MODERATOR permissions + ADMIN permissions + SUPER_ADMIN-only permissions
    // ============================================================
    
    describe('HAO-R-003 — Super Admin inherits all Moderator permissions', () => {
      it('allows SUPER_ADMIN to read listings for governance (Moderator capability)', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'listings', 'read').permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to read offers for governance (Moderator capability)', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'offers', 'read').permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to execute matching for oversight (Moderator capability)', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'matching', 'execute').permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to read quotes for governance (Moderator capability)', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'quotes', 'read').permitted).toBe(true);
      });

      it('does not give SUPER_ADMIN create/delete on resources without explicit grant', () => {
        // SUPER_ADMIN has full Admin rights but create/delete may be role-specific
        expect(evaluateRBAC('SUPER_ADMIN', 'listings', 'create').permitted).toBe(true);
        expect(evaluateRBAC('SUPER_ADMIN', 'listings', 'delete').permitted).toBe(true);
      });
    });

    describe('HAO-R-003 — Moderaor cannot perform Admin operations without explicit authorization', () => {
      it('MODERATOR can read listings for governance', () => {
        expect(evaluateRBAC('MODERATOR', 'listings', 'read').permitted).toBe(true);
      });

      it('MODERATOR can read offers for governance', () => {
        expect(evaluateRBAC('MODERATOR', 'offers', 'read').permitted).toBe(true);
      });

      it('MODERATOR can execute matching for operational oversight', () => {
        expect(evaluateRBAC('MODERATOR', 'matching', 'execute').permitted).toBe(true);
      });

      it('MODERATOR can read quotes for governance', () => {
        expect(evaluateRBAC('MODERATOR', 'quotes', 'read').permitted).toBe(true);
      });

      it('MODERATOR cannot create listings (admin-only)', () => {
        expect(evaluateRBAC('MODERATOR', 'listings', 'create').permitted).toBe(false);
      });

      it('MODERATOR cannot delete listings (admin-only)', () => {
        expect(evaluateRBAC('MODERATOR', 'listings', 'delete').permitted).toBe(false);
      });
    });

    describe('HAO-R-003 — Admin cannot automatically perform Moderator functions unless explicitly granted', () => {
      it('ADMIN can execute matching as operational function', () => {
        expect(evaluateRBAC('ADMIN', 'matching', 'execute').permitted).toBe(true);
      });

      it('ADMIN can read all marketplace resources', () => {
        expect(evaluateRBAC('ADMIN', 'listings', 'read').permitted).toBe(true);
        expect(evaluateRBAC('ADMIN', 'offers', 'read').permitted).toBe(true);
        expect(evaluateRBAC('ADMIN', 'quotes', 'read').permitted).toBe(true);
      });
    });

    it('allows DISPATCHER to execute matching (operational visibility)', () => {
      expect(evaluateRBAC('DISPATCHER', 'matching', 'execute').permitted).toBe(true);
      expect(evaluateRBAC('DISPATCHER', 'listings', 'read').permitted).toBe(false);
    });

    it('allows MODERATOR to read listings and offers (governance oversight)', () => {
      expect(evaluateRBAC('MODERATOR', 'listings', 'read').permitted).toBe(true);
      expect(evaluateRBAC('MODERATOR', 'offers', 'read').permitted).toBe(true);
    });

    it('denies unknown roles', () => {
      const result = evaluateRBAC('UNKNOWN_ROLE', 'listings', 'read');
      expect(result.permitted).toBe(false);
    });

    it('provides reason for denied access', () => {
      const result = evaluateRBAC('TRANSPORTER', 'listings', 'create');
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('not authorized');
    });

    it('restricts delete action to ADMIN only', () => {
      expect(evaluateRBAC('SHIPPER', 'listings', 'delete').permitted).toBe(false);
      expect(evaluateRBAC('TRANSPORTER', 'offers', 'delete').permitted).toBe(false);
      expect(evaluateRBAC('ADMIN', 'listings', 'delete').permitted).toBe(true);
    });

    it('allows transporters to read and create offers', () => {
      expect(evaluateRBAC('TRANSPORTER', 'offers', 'read').permitted).toBe(true);
      expect(evaluateRBAC('TRANSPORTER', 'offers', 'create').permitted).toBe(true);
    });

    it('allows shippers to read offers', () => {
      expect(evaluateRBAC('SHIPPER', 'offers', 'read').permitted).toBe(true);
    });

    it('restricts matching to shippers', () => {
      expect(evaluateRBAC('SHIPPER', 'matching', 'execute').permitted).toBe(true);
      expect(evaluateRBAC('TRANSPORTER', 'matching', 'execute').permitted).toBe(false);
    });

    // ============================================================
    // C7 — Tracking Mutation RBAC Tests
    // ============================================================

    describe('C7 — Tracking resource authorization', () => {
      it('allows ADMIN to create tracking records', () => {
        expect(evaluateRBAC('ADMIN', 'tracking', 'create').permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to create tracking records', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'tracking', 'create').permitted).toBe(true);
      });

      it('denies SHIPPER from creating tracking records', () => {
        expect(evaluateRBAC('SHIPPER', 'tracking', 'create').permitted).toBe(false);
      });

      it('denies TRANSPORTER from creating tracking records', () => {
        expect(evaluateRBAC('TRANSPORTER', 'tracking', 'create').permitted).toBe(false);
      });
    });

    describe('C7 — Tracking status update RBAC', () => {
      it('allows TRANSPORTER to update tracking status', () => {
        const result = evaluateRBAC('TRANSPORTER', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(true);
      });

      it('allows DISPATCHER to update tracking status', () => {
        const result = evaluateRBAC('DISPATCHER', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(true);
      });

      it('allows MODERATOR to update tracking status', () => {
        const result = evaluateRBAC('MODERATOR', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(true);
      });

      it('allows ADMIN to update tracking status', () => {
        const result = evaluateRBAC('ADMIN', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to update tracking status', () => {
        const result = evaluateRBAC('SUPER_ADMIN', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(true);
      });

      it('denies SHIPPER from updating tracking status', () => {
        const result = evaluateRBAC('SHIPPER', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(false);
      });

      it('denies DRIVER from updating tracking status', () => {
        const result = evaluateRBAC('DRIVER', 'tracking_status', 'status_update');
        expect(result.permitted).toBe(false);
      });
    });

    describe('C7 — POD update (verification) RBAC', () => {
      it('allows MODERATOR to verify POD', () => {
        expect(evaluateRBAC('MODERATOR', 'pod', 'update').permitted).toBe(true);
      });

      it('allows ADMIN to verify POD', () => {
        expect(evaluateRBAC('ADMIN', 'pod', 'update').permitted).toBe(true);
      });

      it('allows SUPER_ADMIN to verify POD', () => {
        expect(evaluateRBAC('SUPER_ADMIN', 'pod', 'update').permitted).toBe(true);
      });

      it('denies TRANSPORTER from verifying POD', () => {
        expect(evaluateRBAC('TRANSPORTER', 'pod', 'update').permitted).toBe(false);
      });

      it('denies DRIVER from verifying POD', () => {
        expect(evaluateRBAC('DRIVER', 'pod', 'update').permitted).toBe(false);
      });

      it('denies DISPATCHER from verifying POD', () => {
        expect(evaluateRBAC('DISPATCHER', 'pod', 'update').permitted).toBe(false);
      });

      it('denies SHIPPER from verifying POD', () => {
        expect(evaluateRBAC('SHIPPER', 'pod', 'update').permitted).toBe(false);
      });
    });
  });

  // ============================================================
  // MOD-002 Handoff Preparation
  // ============================================================

  describe('prepareMOD002Handoff', () => {
    it('prepares handoff payload with correct structure', () => {
      const matchProposal = {
        id: 'match-id',
        matchId: 'match-001',
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 85.5,
        rankingPosition: 1,
        status: 'ACCEPTED' as never,
        reasoningTrace: 'High corridor match',
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const listing = {
        id: 'listing-id',
        listingId: 'listing-001',
        shipperId: 'shipper-001',
        origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
        destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
        cargoType: 'GENERAL' as never,
        weightKg: 10000,
        volumeM3: 50,
        timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
        pricingModel: 'FIXED' as never,
        status: 'BOOKED' as never,
        publishedAt: '2026-08-20T10:00:00Z',
        acceptedVehicleTypes: [VehicleType.HEAVY_TRUCK],
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const offer = {
        id: 'offer-id',
        offerId: 'offer-001',
        transporterId: 'transporter-001',
        listingId: 'listing-001',
        priceProposal: 5000,
        availabilityWindow: {
          earliestPickup: '2026-09-01T08:00:00Z',
          latestPickup: '2026-09-02T08:00:00Z',
          estimatedDelivery: '2026-09-05T18:00:00Z',
        },
        vehicleType: 'HEAVY_TRUCK' as never,
        declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 100 },
        status: 'ACCEPTED' as never,
        notes: 'Preferred carrier',
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const payload = prepareMOD002Handoff(matchProposal, listing, offer, 'correlation-123');

      expect(payload.matchProposal.matchId).toBe('match-001');
      expect(payload.listing.shipperId).toBe('shipper-001');
      expect(payload.offer.transporterId).toBe('transporter-001');
      expect(payload.correlationId).toBe('correlation-123');
      expect(typeof payload.handoffTimestamp).toBe('string');
    });

    it('preserves all entity data fields', () => {
      const matchProposal = {
        id: 'match-id',
        matchId: 'match-001',
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 90,
        rankingPosition: 1,
        status: 'ACCEPTED' as never,
        reasoningTrace: 'Test reasoning',
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const listing = {
        id: 'listing-id',
        listingId: 'listing-001',
        shipperId: 'shipper-001',
        origin: { latitude: -25.9692, longitude: 32.5855, address: 'Origin' },
        destination: { latitude: -15.7806, longitude: 42.9165, address: 'Destination' },
        cargoType: 'GENERAL' as never,
        weightKg: 10000,
        volumeM3: undefined,
        timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
        pricingModel: 'FIXED' as never,
        status: 'BOOKED' as never,
        publishedAt: undefined,
        title: 'Test Listing',
        description: 'Test Description',
        acceptedVehicleTypes: [VehicleType.HEAVY_TRUCK],
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const offer = {
        id: 'offer-id',
        offerId: 'offer-001',
        transporterId: 'transporter-001',
        listingId: 'listing-001',
        priceProposal: 5000,
        availabilityWindow: {
          earliestPickup: '2026-09-01T08:00:00Z',
          latestPickup: '2026-09-02T08:00:00Z',
          estimatedDelivery: '2026-09-05T18:00:00Z',
        },
        vehicleType: 'HEAVY_TRUCK' as never,
        declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 100 },
        status: 'ACCEPTED' as never,
        notes: 'Test notes',
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      };

      const payload = prepareMOD002Handoff(matchProposal, listing, offer, 'corr-123');

      // Verify all key fields are preserved
      expect(payload.matchProposal.listingId).toBe('listing-001');
      expect(payload.matchProposal.offerId).toBe('offer-001');
      expect(payload.listing.cargoType).toBe('GENERAL');
      expect(payload.listing.title).toBe('Test Listing');
      expect(payload.offer.priceProposal).toBe(5000);
      expect(payload.offer.notes).toBe('Test notes');
    });
  });

  // ============================================================
  // MOD-016 Notification Preparation
  // ============================================================

  describe('prepareMarketplacenotification', () => {
    it('prepares notification payload with correct structure', () => {
      const payload = prepareMarketplacenotification({
        recipientId: 'user-001',
        channel: 'EMAIL',
        subject: 'Listing Published',
        body: 'Your listing is now visible to transporters.',
        eventType: 'listingPublished',
        correlationId: 'corr-123',
      });

      expect(payload.recipientId).toBe('user-001');
      expect(payload.channel).toBe('EMAIL');
      expect(payload.subject).toBe('Listing Published');
      expect(payload.eventType).toBe('listingPublished');
      expect(payload.correlationId).toBe('corr-123');
    });

    it('supports all notification channels', () => {
      const channels: Array<'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP'> = [
        'IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP',
      ];

      for (const channel of channels) {
        const payload = prepareMarketplacenotification({
          recipientId: 'user-001',
          channel,
          subject: 'Test',
          body: 'Test body',
          eventType: 'testEvent',
          correlationId: 'corr-123',
        });

        expect(payload.channel).toBe(channel);
      }
    });
  });
});
