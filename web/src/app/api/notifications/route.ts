// NexCargo MOD-016 — Notification Creation API Route (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// POST /api/notifications
// Creates a notification record with validation, persistence, and delivery event tracking.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { validateNotificationCreation, applyNotificationDefaults, normalizePriorityLevel, normalizeChannelType } from '@/modules/mod-016-notifications/domain/services/notification-validation';
import { PriorityLevel } from '@/modules/mod-016-notifications/domain/enums';

// ============================================================
// Environment & Client Setup
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// Request Body Type (string-based for JSON parsing)
// ============================================================

interface CreateNotificationRequest {
  recipientId: string;
  sourceModule: string;
  eventType: string;
  title?: string;
  body?: string;
  priorityLevel?: string;
  channelType: string;
  locale?: string;
  correlationId: string;
  templateId?: string;
  providerChannel?: string;
}

// ============================================================
// Response Type
// ============================================================

interface ApiResponse {
  success: boolean;
  data?: NotificationResponse;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; correlationId: string };
}

interface NotificationResponse {
  notificationId: string;
  recipientId: string;
  sourceModule: string;
  eventType: string;
  title: string;
  body: string;
  priorityLevel: string;
  channelType: string;
  status: string;
  locale: string;
  correlationId: string;
  retryCount: number;
  createdAt: string;
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestCorrelationId = crypto.randomUUID();
  
  try {
    // Parse request body
    const body: CreateNotificationRequest = await request.json();

    // Validate input structure and business rules (MOD-016 §4.1, §7.2)
    validateNotificationCreation(body);

    // Apply defaults (priority_level, retry_count, locale) via service functions
    const normalizedBody = applyNotificationDefaults(body);
    const priorityLevelValue = normalizePriorityLevel(normalizedBody.priorityLevel) ?? PriorityLevel.MEDIUM;
    const channelTypeValue = normalizeChannelType(body.channelType) || body.channelType;

    // Insert into communication_schema.notifications
    const { data, error } = await supabase
      .schema('communication_schema')
      .from('notifications')
      .insert({
        recipient_id: body.recipientId,
        source_module: body.sourceModule,
        event_type: body.eventType,
        title: body.title || '',
        body: body.body || '',
        priority_level: priorityLevelValue,
        channel_type: channelTypeValue,
        locale: body.locale || 'pt',
        correlation_id: body.correlationId,
        template_id: body.templateId || null,
        provider_channel: body.providerChannel || null,
        status: 'QUEUED',
        retry_count: 0,
      })
      .select('id, recipient_id, source_module, event_type, title, body, priority_level, channel_type, status, locale, correlation_id, retry_count, created_at')
      .single();

    if (error) {
      console.error('[MOD-016 POST /api/notifications] Database insert error:', error);
      return buildErrorResponse(
        'ERR_1000',
        'Failed to create notification record',
        { databaseError: error.message },
        requestCorrelationId,
      );
    }

    if (!data?.id) {
      return buildErrorResponse(
        'ERR_1000',
        'Unexpected: no notification ID returned from database',
        {},
        requestCorrelationId,
      );
    }

    // Build response
    const response: NotificationResponse = {
      notificationId: data.id,
      recipientId: data.recipient_id,
      sourceModule: data.source_module,
      eventType: data.event_type,
      title: data.title,
      body: data.body,
      priorityLevel: data.priority_level,
      channelType: data.channel_type,
      status: data.status,
      locale: data.locale,
      correlationId: data.correlation_id,
      retryCount: data.retry_count,
      createdAt: data.created_at,
    };

    const elapsed = Date.now() - startTime;
    console.log(`[MOD-016 POST /api/notifications] Created notification ${data.id} in ${elapsed}ms`, {
      recipientId: response.recipientId,
      eventType: response.eventType,
      module: response.sourceModule,
    });

    return NextResponse.json(
      {
        success: true,
        data: response,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      } satisfies ApiResponse,
      { status: 201 },
    );

  } catch (err) {
    if (err instanceof ValidationError) {
      return buildErrorResponse(err.code, err.message, err.details, requestCorrelationId);
    }
    
    console.error('[MOD-016 POST /api/notifications] Unexpected error:', err);
    return buildErrorResponse(
      'ERR_1000',
      'Internal server error during notification creation',
      {},
      requestCorrelationId,
    );
  }
}

// ============================================================
// Helper Functions
// ============================================================

function buildErrorResponse(
  code: string,
  message: string,
  details: Record<string, unknown> | undefined,
  correlationId: string,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    } satisfies ApiResponse,
    { status: 400 },
  );
}
