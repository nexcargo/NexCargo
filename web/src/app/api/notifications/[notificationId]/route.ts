// NexCargo MOD-016 — Notification Retrieval API Route (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// GET /api/notifications/[notificationId]
// Retrieves a notification record with correlation tracking.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const requestCorrelationId = crypto.randomUUID();
  
  try {
    // Resolve params promise (Next.js App Router pattern for dynamic routes)
    const { notificationId } = await params;

    if (!notificationId || notificationId.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_1001',
            message: 'notificationId parameter is required',
          },
          meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
        },
        { status: 400 },
      );
    }

    // Query notification by ID (RLS will enforce access control on server)
    const { data, error } = await supabase
      .schema('communication_schema')
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_1002',
              message: `Notification with id ${notificationId} not found`,
            },
            meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
          },
          { status: 404 },
        );
      }
      
      console.error('[MOD-016 GET /api/notifications/:id] Database error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_1000',
            message: 'Failed to retrieve notification',
          },
          meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_1002',
            message: `Notification with id ${notificationId} not found`,
          },
          meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
        },
        { status: 404 },
      );
    }

    // Map database columns to response shape
    const notification = {
      notificationId: data.id,
      recipientId: data.recipient_id,
      sourceModule: data.source_module,
      eventType: data.event_type,
      title: data.title,
      body: data.body,
      priorityLevel: data.priority_level,
      channelType: data.channel_type,
      status: data.delivery_status || data.status,
      locale: data.locale,
      correlationId: data.correlation_id,
      templateId: data.template_id,
      providerChannel: data.provider_channel,
      retryCount: data.retry_count,
      deliveredAt: data.delivered_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json(
      {
        success: true,
        data: notification,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      },
      { status: 200 },
    );

  } catch (err) {
    console.error('[MOD-016 GET /api/notifications/:id] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_1000',
          message: 'Internal server error',
        },
        meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
      },
      { status: 500 },
    );
  }
}
