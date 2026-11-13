// NexCargo I-5 §3G/§3H — the session-scoped document read for the Transporter area.
// DocumentRepository.listByEntity uses createAdminClient(), which bypasses RLS, so it is deliberately not
// reused here. This reads through the session client and lets the documents policies decide: a Transporter
// sees booking-linked documents where bookings.transporter_id is this user, and contract-linked documents
// where the contract's booking names this user as a party. Shipment-linked documents have no Transporter
// read policy, so they are not queried rather than shown empty.

import { createClient } from '@/lib/supabase/server';

interface DocumentRow {
  id: string;
  document_id: string;
  document_type: string;
  linked_entity_type: string;
  linked_entity_id: string;
  status: string;
  issue_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface TransporterDocument {
  id: string;
  documentId: string;
  documentType: string;
  linkedEntityType: string;
  linkedEntityId: string;
  status: string;
  issueDate: string | undefined;
  expiryDate: string | undefined;
  createdAt: string;
}

const COLUMNS = 'id, document_id, document_type, linked_entity_type, linked_entity_id, status, issue_date, expiry_date, created_at';

function toDocument(row: DocumentRow): TransporterDocument {
  return {
    id: row.id,
    documentId: row.document_id,
    documentType: row.document_type,
    linkedEntityType: row.linked_entity_type,
    linkedEntityId: row.linked_entity_id,
    status: row.status,
    issueDate: row.issue_date ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listDocumentsForEntity(
  entityType: 'booking' | 'contract',
  entityId: string,
): Promise<TransporterDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('logistics_schema')
    .from('documents')
    .select(COLUMNS)
    .eq('linked_entity_type', entityType)
    .eq('linked_entity_id', entityId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list documents: ${error.message}`);
  return (data as unknown as DocumentRow[]).map(toDocument);
}