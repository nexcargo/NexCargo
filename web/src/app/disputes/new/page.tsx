// NexCargo — Dispute Creation Form
// MOD-015 Support & Dispute Resolution Foundation / C7-Increment 004
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Button } from '@/shared/ui/components/button';
import { Select, Input, Textarea } from '@/shared/ui/components/form-controls';
import { Spinner } from '@/shared/ui/components/spinner';

interface FormErrors {
  disputeType?: string;
  relatedShipmentId?: string;
  caseId?: string;
  evidenceReferences?: string;
}

export default function NewDisputePage() {
  const router = useRouter();
  const [disputeType, setDisputeType] = useState('');
  const [relatedShipmentId, setRelatedShipmentId] = useState('');
  const [relatedContractId, setRelatedContractId] = useState('');
  const [relatedEscrowId, setRelatedEscrowId] = useState('');
  const [respondentId, setRespondentId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [evidenceReferences, setEvidenceReferences] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!disputeType) {
      newErrors.disputeType = 'Dispute type is required.';
    }

    if (!relatedShipmentId.trim()) {
      newErrors.relatedShipmentId = 'Related shipment ID is required.';
    }

    if (!caseId.trim()) {
      newErrors.caseId = 'Case ID is required.';
    }

    if (evidenceReferences.trim()) {
      try {
        JSON.parse(evidenceReferences);
      } catch {
        newErrors.evidenceReferences = 'Evidence references must be valid JSON array format.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        dispute_type: disputeType,
        related_shipment_id: relatedShipmentId.trim(),
        case_id: caseId.trim(),
      };

      if (relatedContractId.trim()) {
        body.related_contract_id = relatedContractId.trim();
      }

      if (relatedEscrowId.trim()) {
        body.related_escrow_id = relatedEscrowId.trim();
      }

      if (respondentId.trim()) {
        body.respondent_id = respondentId.trim();
      }

      if (evidenceReferences.trim()) {
        body.evidence_references = JSON.parse(evidenceReferences);
      }

      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Failed to create dispute (${res.status})`);
      }

      const data = await res.json();
      router.push(`/disputes/${data.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const disputeTypeOptions = [
    { value: 'PAYMENT', label: 'Payment' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'DAMAGE', label: 'Damage' },
    { value: 'DELAY', label: 'Delay' },
    { value: 'CONTRACT', label: 'Contract' },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/dispatcher" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-foreground">New Dispute</h1>
      </div>

      {submitError && (
        <Card variant="outline" className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dispute Details</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill out the information below to submit a new dispute case.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Dispute Type */}
            <div className="space-y-2">
              <label htmlFor="disputeType" className="text-sm font-medium text-foreground">
                Dispute Type <span className="text-red-500">*</span>
              </label>
              <Select
                id="disputeType"
                value={disputeType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDisputeType(e.target.value)}
              >
                <option value="">Select type...</option>
                {disputeTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              {errors.disputeType && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.disputeType}</p>
              )}
            </div>

            {/* Related Shipment ID */}
            <div className="space-y-2">
              <label htmlFor="relatedShipmentId" className="text-sm font-medium text-foreground">
                Related Shipment ID <span className="text-red-500">*</span>
              </label>
              <Input
                id="relatedShipmentId"
                type="text"
                placeholder="e.g. SHP-XXXXX"
                value={relatedShipmentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRelatedShipmentId(e.target.value)}
              />
              {errors.relatedShipmentId && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.relatedShipmentId}</p>
              )}
            </div>

            {/* Case ID */}
            <div className="space-y-2">
              <label htmlFor="caseId" className="text-sm font-medium text-foreground">
                Case ID <span className="text-red-500">*</span>
              </label>
              <Input
                id="caseId"
                type="text"
                placeholder="Unique case identifier"
                value={caseId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaseId(e.target.value)}
              />
              {errors.caseId && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.caseId}</p>
              )}
            </div>

            {/* Related Contract ID */}
            <div className="space-y-2">
              <label htmlFor="relatedContractId" className="text-sm font-medium text-foreground">
                Related Contract ID <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="relatedContractId"
                type="text"
                placeholder="e.g. CNT-XXXXX"
                value={relatedContractId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRelatedContractId(e.target.value)}
              />
            </div>

            {/* Related Escrow ID */}
            <div className="space-y-2">
              <label htmlFor="relatedEscrowId" className="text-sm font-medium text-foreground">
                Related Escrow ID <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="relatedEscrowId"
                type="text"
                placeholder="e.g. ESC-XXXXX"
                value={relatedEscrowId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRelatedEscrowId(e.target.value)}
              />
            </div>

            {/* Respondent ID */}
            <div className="space-y-2">
              <label htmlFor="respondentId" className="text-sm font-medium text-foreground">
                Respondent ID <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="respondentId"
                type="text"
                placeholder="User ID of the respondent"
                value={respondentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRespondentId(e.target.value)}
              />
            </div>

            {/* Evidence References */}
            <div className="space-y-2">
              <label htmlFor="evidenceReferences" className="text-sm font-medium text-foreground">
                Evidence References <span className="text-muted-foreground font-normal">(JSON array, optional)</span>
              </label>
              <Textarea
                id="evidenceReferences"
                rows={5}
                placeholder='[{"type":"document","url":"https://..."},{"type":"screenshot","url":"https://..."}]'
                value={evidenceReferences}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvidenceReferences(e.target.value)}
              />
              {errors.evidenceReferences && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.evidenceReferences}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Submit Dispute
          </Button>
        </div>
      </form>
    </div>
  );
}
