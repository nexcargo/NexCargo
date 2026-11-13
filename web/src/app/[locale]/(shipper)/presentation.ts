// NexCargo I-4 — shared presentation helpers for the Shipper screens.
// Framework-free so both Server and Client Components can import it.

export const LISTING_STATUSES = ['DRAFT', 'PUBLISHED', 'EXPIRED', 'CANCELLED', 'BOOKED', 'COMPLETED'] as const;

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const LISTING_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  EXPIRED: 'warning',
  CANCELLED: 'danger',
  BOOKED: 'info',
  COMPLETED: 'default',
};

const OFFER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  SUBMITTED: 'info',
  WITHDRAWN: 'neutral',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const BOOKING_STATUS_VARIANT: Record<string, BadgeVariant> = {
  REQUESTED: 'info',
  ALIGNMENT_CHECKED: 'warning',
  CONFIRMED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

export function listingStatusVariant(status: string): BadgeVariant {
  return LISTING_STATUS_VARIANT[status] ?? 'neutral';
}

export function offerStatusVariant(status: string): BadgeVariant {
  return OFFER_STATUS_VARIANT[status] ?? 'neutral';
}

export function bookingStatusVariant(status: string): BadgeVariant {
  return BOOKING_STATUS_VARIANT[status] ?? 'neutral';
}

function intlLocale(locale: string): string {
  return locale === 'pt' ? 'pt-PT' : 'en-GB';
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(intlLocale(locale));
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(intlLocale(locale));
}

export function formatWeight(kg: number | null | undefined, locale: string): string {
  if (kg == null) return '';
  return `${new Intl.NumberFormat(intlLocale(locale)).format(kg)} kg`;
}

export function formatMoney(amount: number | null | undefined, currency: string, locale: string): string {
  if (amount == null) return '';
  return new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency }).format(amount);
}

/** `YYYY-MM-DDTHH:mm` — the value format an <input type="datetime-local"> accepts and emits. */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
