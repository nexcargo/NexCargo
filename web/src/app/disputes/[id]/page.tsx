// NexCargo — Dispute Case View
// MOD-015 Support & Dispute Resolution Foundation / C7-Increment 004
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Badge } from '@/shared/ui/components/badge';
import { Button } from '@/shared/ui/components/button';
import { Spinner } from '@/shared/ui/components/spinner';

interface DisputeDetail {
  id: string;
  caseNumber?: string;
  relatedShipmentId: string;
  relatedContractId?: string;
  relatedEscrowId?: string;
  disputeType: string;
  initiatorId: string;
  respondentId?: string;
  status: string;
  evidenceReferences?: unknown[];
  resolutionOutcome?: string;
  decisionMakerId?: string;
  decisionTimestamp?: string;
  resolutionSummary?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

const statusBadgeMap: Record<string, 'info' | 'warning' | 'danger' | 'success' | 'neutral'> = {
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  ESCALATED: 'danger',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const disputeTypeLabels: Record<string, string> = {
  PAYMENT: 'Payment',
  DELIVERY: 'Delivery',
  DAMAGE: 'Damage',
  DELAY: 'Delay',
  CONTRACT: 'Contract',
};

function formatDate(iso?: string): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString();
}

export default function DisputeViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    fetchDispute();
  }, [params.id]);

  const fetchDispute = async () => {
    try {
      const res = await fetch(`/api/disputes/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setDispute(null);
          setError('Dispute not found.');
        } else {
          throw new Error(`Failed to load dispute (${res.status})`);
        }
        return;
      }
      const data = await res.json();
      setDispute(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-3">
        <Spinner />
        <span className="text-sm text-muted-foreground">Loading dispute...</span>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Link href="/dispatcher" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Dashboard
          </Link>
        </div>
        <Card variant="outline" className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-6">
            <p className="text-sm text-red-700 dark:text-red-300">{error || 'Dispute not found.'}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push('/disputes/new')}>
              Create New Dispute
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const badgeVariant = statusBadgeMap[dispute.status] || 'default';
  const typeLabel = disputeTypeLabels[dispute.disputeType] || dispute.disputeType;
  const isResolved = dispute.status === 'RESOLVED';

  const timelineEvents = [
    { label: 'Created', time: dispute.createdAt },
    { label: 'Last Updated', time: dispute.updatedAt },
    ...(dispute.decisionTimestamp ? [{ label: 'Decision', time: dispute.decisionTimestamp }] : []),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/dispatcher" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
        <Link href={`/disputes/${dispute.id}/edit`} className="text-sm text-blue-600 hover:underline">
          Edit Dispute
        </Link>
      </div>

      {/* Header with case number, status badge, type */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{dispute.caseNumber || dispute.caseId || `Case ${dispute.id.slice(0, 8)}`}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {typeLabel} dispute initiated on {formatDate(dispute.createdAt)}
              </p>
            </div>
            <Badge variant={badgeVariant} size="md">
              {dispute.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related Shipment</p>
              <p className="text-sm font-medium">
                <Link href={`/tracking/${dispute.relatedShipmentId}`} className="text-blue-600 hover:underline">
                  {dispute.relatedShipmentId}
                </Link>
              </p>
            </div>
            {dispute.relatedContractId && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related Contract</p>
                <p className="text-sm font-medium">{dispute.relatedContractId}</p>
              </div>
            )}
            {dispute.relatedEscrowId && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related Escrow</p>
                <p className="text-sm font-medium">{dispute.relatedEscrowId}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Initiator</p>
              <p className="text-sm font-medium">{dispute.initiatorId}</p>
            </div>
            {dispute.respondentId && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Respondent</p>
                <p className="text-sm font-medium">{dispute.respondentId}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Case ID</p>
              <p className="text-sm font-medium">{dispute.caseId || dispute.id}</p>
            </div>
          </div>

          {/* Resolution info (if resolved) */}
          {isResolved && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Resolution Outcome</p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">{dispute.resolutionOutcome || '\u2014'}</p>
              {dispute.resolutionSummary && (
                <>
                  <p className="mt-2 text-sm font-medium text-green-800 dark:text-green-300">Decision Summary</p>
                  <p className="text-sm text-green-700 dark:text-green-400">{dispute.resolutionSummary}</p>
                </>
              )}
              {dispute.decisionMakerId && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-500">Decided by: {dispute.decisionMakerId}</p>
              )}
            </div>
          )}

          {/* Evidence Section */}
          {(dispute.evidenceReferences && Array.isArray(dispute.evidenceReferences)) && (
            <div className="space-y-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground"
                onClick={() => setShowEvidence(!showEvidence)}
              >
                <span className={`transition-transform ${showEvidence ? 'rotate-90' : ''}`}>▶</span>
                Evidence ({Array.isArray(dispute.evidenceReferences) ? dispute.evidenceReferences.length : 0})
              </button>
              {showEvidence && (
                <div className="ml-6 space-y-2">
                  {(dispute.evidenceReferences as Array<Record<string, unknown>>).map((item, idx) => {
                    const typeVal = typeof item === 'object' && item !== null ? String(item.type ?? `Evidence #${idx + 1}`) : String(item);
                    const urlVal = typeof item === 'object' && item !== null ? String((item as Record<string, unknown>).url ?? '') : '';
                    return (
                      <div key={idx} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
                        <p className="font-medium">{typeVal}</p>
                        {urlVal && (
                          <a
                            href={urlVal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-1 text-xs text-blue-600 hover:underline truncate"
                          >
                            {urlVal}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Timeline / Activity Feed */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Timeline</p>
            <div className="space-y-2">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <span className="font-medium text-muted-foreground">{event.label}:</span>
                  <span className="text-muted-foreground">{formatDate(event.time)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!isResolved && dispute.status !== 'CLOSED' && (
          <Button variant="danger" size="sm" onClick={() => router.push(`/disputes/${dispute.id}/escalate?entityId=${dispute.id}&entityType=DISPUTE`)}>
            Escalate
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          Print Report
        </Button>
      </div>
    </div>
  );
}
