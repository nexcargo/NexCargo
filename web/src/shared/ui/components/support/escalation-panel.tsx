// NexCargo — Escalation Panel (Reusable)
// MOD-015 Support & Dispute Resolution Foundation / C7-Increment 004
'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Badge } from '@/shared/ui/components/badge';
import { Button } from '@/shared/ui/components/button';
import { Select, Textarea } from '@/shared/ui/components/form-controls';
import { Spinner } from '@/shared/ui/components/spinner';

export interface EscalationPanelProps {
  entityId: string;
  entityType: 'DISPUTE' | 'TICKET' | 'INCIDENT' | 'EXCEPTION';
  currentLevel?: string;
  onEscalated?: () => void;
}

const escalationLevels = [
  { value: 'L1', label: 'Level 1 — Frontline Support' },
  { value: 'L2', label: 'Level 2 — Senior Analyst' },
  { value: 'L3', label: 'Level 3 — Management / Legal' },
];

function EscalationPanel({ entityId, entityType, currentLevel, onEscalated }: EscalationPanelProps) {
  const [isEscalating, setIsEscalating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [escalationLevel, setEscalationLevel] = useState('');
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedEntityId = entityId.startsWith(`${entityType.toLowerCase()}-`)
    ? entityId
    : `${entityType.toLowerCase()}-${entityId}`;

  const handleEscalate = async () => {
    setSubmitError(null);
    setSuccessMessage(null);

    if (!escalationLevel || !reason.trim()) return;

    setIsEscalating(true);

    try {
      let endpoint = `/api/disputes/${normalizedEntityId}/escalate`;
      if (entityType !== 'DISPUTE') {
        endpoint = `/api/${entityType.toLowerCase()}/${normalizedEntityId}/escalate`;
      }

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalation_level: escalationLevel,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Escalation failed (${res.status})`);
      }

      setSuccessMessage(`Successfully escalated to ${escalationLevel}.`);
      setShowForm(false);
      setEscalationLevel('');
      setReason('');
      onEscalated?.();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsEscalating(false);
    }
  };

  const displayLevel = currentLevel || 'NONE';
  const levelColors: Record<string, 'info' | 'warning' | 'danger' | 'neutral'> = {
    NONE: 'neutral',
    L1: 'info',
    L2: 'warning',
    L3: 'danger',
  };

  return (
    <Card variant="outline" className="space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Escalation Status</CardTitle>
          <Badge variant={levelColors[displayLevel] || 'neutral'} size="sm">
            {displayLevel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info row */}
        <p className="text-sm text-muted-foreground">
          Entity: <span className="font-mono text-xs">{normalizedEntityId}</span> ({entityType})
        </p>

        {/* Success / Error messages */}
        {successMessage && (
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        )}
        {submitError && (
          <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
        )}

        {/* Escalation form toggle */}
        {!showForm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={displayLevel === 'L3'}
          >
            Escalate
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
            <div className="space-y-2">
              <label htmlFor={`esc-${entityType}-level`} className="text-sm font-medium">
                Escalation Level <span className="text-red-500">*</span>
              </label>
              <Select
                id={`esc-${entityType}-level`}
                value={escalationLevel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEscalationLevel(e.target.value)}
              >
                <option value="">Select level...</option>
                {escalationLevels.filter(l => l.value !== displayLevel).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor={`esc-${entityType}-reason`} className="text-sm font-medium">
                Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                id={`esc-${entityType}-reason`}
                rows={3}
                placeholder="Describe why this needs escalation..."
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                onClick={handleEscalate}
                isLoading={isEscalating}
                disabled={!escalationLevel || !reason.trim()}
              >
                Confirm Escalation
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEscalationLevel('');
                  setReason('');
                  setSubmitError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EscalationPanel;
