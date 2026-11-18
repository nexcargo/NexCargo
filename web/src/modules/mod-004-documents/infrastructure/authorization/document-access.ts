// NexCargo MOD-004 — shared document access verification.
// Single source of the application-layer document authorization model previously duplicated in the
// download and preview routes. The metadata read routes (GET /api/documents, GET /api/documents/[id])
// enforce the same model, because the repository reads through the service-role client and RLS
// therefore does not constrain those reads.
//
// Authorization logic:
// - Owner (created_by): always allowed
// - MODERATOR/ADMIN/SUPER_ADMIN: read access (governance tiers). This matches the database RLS
//   SELECT policy "I2 delegated reads documents", which admits these platform roles to document
//   reads, and the documents:read RBAC matrix entry. PRE-I-6 FINAL COMPLETION DIRECTIVE Item 2
//   resolved the prior inconsistency where the matrix and RLS admitted MODERATOR but this gate
//   refused it. Read only: this confers no upload, verification or financial authority.
// - SHIPPER: linked_entity_type=booking AND user is the booking's shipper,
//            OR linked_entity_type=contract AND user is the contract's booking's shipper
// - TRANSPORTER: same chains against bookings.transporter_id
// - All other cases: denied (fail closed)

import { createAdminClient } from '@/infrastructure/database/supabase';

export interface DocumentAccessSubject {
  linked_entity_type: string;
  linked_entity_id: string;
  created_by: string;
}

export async function verifyDocumentAccess(
  document: DocumentAccessSubject,
  userId: string,
  userRole: string | null,
): Promise<boolean> {
  // Owner of the document can always access it
  if (document.created_by === userId) {
    return true;
  }

  // Governance tiers have read access, matching the DB RLS "I2 delegated reads documents" policy.
  if (userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return true;
  }

  // For self-selected roles, check through the entity chain
  const adminClient = createAdminClient();
  const entityType = document.linked_entity_type.toLowerCase();
  const entityId = document.linked_entity_id;

  if (entityType === 'booking') {
    if (userRole === 'SHIPPER') {
      const result = await adminClient
        .schema('logistics_schema')
        .from('bookings')
        .select('shipper_id')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .single();
      return !result.error && result.data?.shipper_id === userId;
    }
    if (userRole === 'TRANSPORTER') {
      const result = await adminClient
        .schema('logistics_schema')
        .from('bookings')
        .select('transporter_id')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .single();
      return !result.error && result.data?.transporter_id === userId;
    }
  }

  if (entityType === 'contract') {
    // Check through contracts → bookings chain
    if (userRole === 'SHIPPER') {
      const result = await adminClient
        .schema('logistics_schema')
        .from('contracts')
        .select('booking_id')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .single();

      if (!result.error && result.data) {
        const bookingCheck = await adminClient
          .schema('logistics_schema')
          .from('bookings')
          .select('shipper_id')
          .eq('id', (result.data as { booking_id: string }).booking_id)
          .eq('is_deleted', false)
          .single();
        return !bookingCheck.error && bookingCheck.data?.shipper_id === userId;
      }
    }
    if (userRole === 'TRANSPORTER') {
      const result = await adminClient
        .schema('logistics_schema')
        .from('contracts')
        .select('booking_id')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .single();

      if (!result.error && result.data) {
        const bookingCheck = await adminClient
          .schema('logistics_schema')
          .from('bookings')
          .select('transporter_id')
          .eq('id', (result.data as { booking_id: string }).booking_id)
          .eq('is_deleted', false)
          .single();
        return !bookingCheck.error && bookingCheck.data?.transporter_id === userId;
      }
    }
  }

  // User documents (linked_entity_type='user') - owner check already above

  return false;
}