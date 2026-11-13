// NexCargo I-5 §3G — contract reads for the Transporter's bookings and operations.
// MOD-002 exposes no contracts repository, so this is the one place the Transporter area reads
// logistics_schema.contracts. The session client is the boundary: contracts_transporter_read admits a
// contract only when its booking names auth.uid() as transporter, so no ownership filter is duplicated
// here and no service-role client is used.

import { createClient } from '@/lib/supabase/server';

export interface ContractSummary {
  id: string;
  contractId: string;
  bookingId: string;
  acceptanceStatus: string;
  numSignatories: number;
  shipperAcceptedAt: string | undefined;
  transporterAcceptedAt: string | undefined;
  signedAt: string | undefined;
  digitalSignatureStatus: string;
  baseAmount: number;
  currency: string;
  termsSnapshot: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  createdAt: string;
}

interface ContractRow {
  id: string;
  contract_id: string;
  booking_id: string;
  acceptance_status: string;
  num_signatories: number;
  shipper_accepted_at: string | null;
  transporter_accepted_at: string | null;
  signed_at: string | null;
  digital_signature_status: string;
  base_amount: number | string;
  currency: string;
  terms_snapshot: string;
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_window_start: string;
  delivery_window_end: string;
  created_at: string;
}

const COLUMNS =
  'id, contract_id, booking_id, acceptance_status, num_signatories, shipper_accepted_at, ' +
  'transporter_accepted_at, signed_at, digital_signature_status, base_amount, currency, terms_snapshot, ' +
  'pickup_window_start, pickup_window_end, delivery_window_start, delivery_window_end, created_at';

function toSummary(row: ContractRow): ContractSummary {
  return {
    id: row.id,
    contractId: row.contract_id,
    bookingId: row.booking_id,
    acceptanceStatus: row.acceptance_status,
    numSignatories: row.num_signatories,
    shipperAcceptedAt: row.shipper_accepted_at ?? undefined,
    transporterAcceptedAt: row.transporter_accepted_at ?? undefined,
    signedAt: row.signed_at ?? undefined,
    digitalSignatureStatus: row.digital_signature_status,
    baseAmount: Number(row.base_amount),
    currency: row.currency,
    termsSnapshot: row.terms_snapshot,
    pickupWindowStart: row.pickup_window_start,
    pickupWindowEnd: row.pickup_window_end,
    deliveryWindowStart: row.delivery_window_start,
    deliveryWindowEnd: row.delivery_window_end,
    createdAt: row.created_at,
  };
}

export async function listContractsForBookings(bookingIds: string[]): Promise<Map<string, ContractSummary>> {
  if (bookingIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('logistics_schema').from('contracts')
    .select(COLUMNS)
    .in('booking_id', bookingIds)
    .eq('is_deleted', false);

  if (error) throw new Error(`Failed to list contracts: ${error.message}`);

  return new Map((data as unknown as ContractRow[]).map((row) => [row.booking_id, toSummary(row)]));
}

export async function getContractForBooking(bookingId: string): Promise<ContractSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('logistics_schema').from('contracts')
    .select(COLUMNS)
    .eq('booking_id', bookingId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) throw new Error(`Failed to read contract: ${error.message}`);

  return data ? toSummary(data as unknown as ContractRow) : null;
}

/**
 * MOD-002 §5.1 — the Transporter's own acceptance is the contract signature recorded by
 * accept_and_finalize_contract(). A booking carries no ACCEPTED state, so "awaiting your acceptance"
 * means a DRAFT contract this Transporter has not yet signed.
 */
export function awaitingTransporterSignature(contract: ContractSummary | null | undefined): boolean {
  return !!contract && contract.acceptanceStatus === 'DRAFT' && !contract.transporterAcceptedAt;
}