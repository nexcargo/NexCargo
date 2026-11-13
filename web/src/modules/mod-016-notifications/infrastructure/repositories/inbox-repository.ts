// NexCargo I-5 §3A — recipient-side inbox read for MOD-016 IN_APP notifications.
// Delivery to a recipient is what the live policy notification_counterparty_read (recipient_id = auth.uid())
// authorises, so this runs on the caller's session client and RLS is the boundary: no new grant, no
// service-role read. Only the columns a recipient is allowed to see are selected.

import { createClient } from '@/lib/supabase/server';

interface NotificationRow {
  id: string;
  title: string | null;
  body: string | null;
  source_module: string | null;
  event_type: string | null;
  priority_level: string | null;
  delivery_status: string | null;
  status: string | null;
  created_at: string;
}

export interface InboxNotification {
  notificationId: string;
  title: string;
  body: string;
  sourceModule: string | null;
  eventType: string | null;
  priorityLevel: string | null;
  /** DELIVERED once the IN_APP executor has run; QUEUED/FAILED while it still owes an attempt. */
  deliveryStatus: string;
  createdAt: string;
}

export async function listInboxNotifications(limit = 10): Promise<InboxNotification[]> {
  const supabase = await createClient();
  const result = await supabase
    .schema('communication_schema')
    .from('notifications')
    .select('id, title, body, source_module, event_type, priority_level, delivery_status, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (result.error) {
    throw new Error(`Failed to list notifications: ${result.error.message}`);
  }

  return (result.data as NotificationRow[]).map(row => ({
    notificationId: row.id,
    title: row.title ?? '',
    body: row.body ?? '',
    sourceModule: row.source_module,
    eventType: row.event_type,
    priorityLevel: row.priority_level,
    deliveryStatus: row.delivery_status ?? row.status ?? 'QUEUED',
    createdAt: row.created_at,
  }));
}
