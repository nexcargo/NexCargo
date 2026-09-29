'use client';

// NexCargo — Asset Assignment View (Dispatcher + Transporter)
// View and manage asset assignments. Separate from MOD-002 driver_assignments.

import { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/components/card';
import { Badge } from '@/shared/ui/components/badge';
import { Button } from '@/shared/ui/components/button';
import { Spinner } from '@/shared/ui/components/spinner';
import Link from 'next/link';

interface AssignmentRow {
  id: string;
  assignmentId: string;
  vehicleId: string | null;
  driverId: string | null;
  shipmentTrackingId: string;
  status: string;
  assignedAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string | null;
}

export default function AssignmentViewPage() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fleet/assignments?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load assignments');
      const result = await res.json();
      setAssignments(result.data || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/fleet/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update', id, status: newStatus }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      } else {
        alert(result.error?.message || 'Update failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filterStatus
    ? assignments.filter(a => a.status === filterStatus)
    : assignments;

  const getStatusVariant = (status: string): 'info' | 'success' | 'neutral' | 'danger' | 'default' | 'warning' => {
    switch (status) {
      case 'PLANNED': return 'info';
      case 'ACTIVE': return 'success';
      case 'COMPLETED': return 'neutral';
      case 'CANCELLED': return 'danger';
      default: return 'default';
    }
  };

  const validTransitions: Record<string, string[]> = {
    PLANNED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="mr-3 h-5 w-5" />
        <span className="text-muted-foreground">Loading assignments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Asset Assignments</h1>
        <Link href="/transporter/fleet">
          <Button variant="outline">Back to Fleet Registry</Button>
        </Link>
      </div>

      {/* Filter */}
      <Card>
        <div className="p-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Assignments List */}
      {filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((assignment) => (
            <Card key={assignment.id}>
              <div className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(assignment.status)}>
                        {assignment.status}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{assignment.assignmentId}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Shipment: <span className="font-mono text-xs">{assignment.shipmentTrackingId.slice(0, 8)}</span>...
                      {assignment.vehicleId && <> | Vehicle: <span className="font-mono text-xs">{assignment.vehicleId.slice(0, 8)}</span>...</>}
                      {assignment.driverId && <> | Driver: <span className="font-mono text-xs">{assignment.driverId.slice(0, 8)}</span>...</>}
                    </div>
                    {(assignment.scheduledStart || assignment.scheduledEnd) && (
                      <p className="text-xs text-muted-foreground">
                        {assignment.scheduledStart ? new Date(assignment.scheduledStart).toLocaleDateString() : '\u2014'} \u2192 {assignment.scheduledEnd ? new Date(assignment.scheduledEnd).toLocaleDateString() : '\u2014'}
                      </p>
                    )}
                  </div>

                  {/* Status transitions */}
                  <div className="flex gap-2">
                    {(validTransitions[assignment.status] || []).map((transition) => (
                      <Button
                        key={transition}
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusUpdate(assignment.id, transition)}
                        disabled={submitting}
                      >
                        \u2192 {transition}
                      </Button>
                    ))}
                  </div>
                </div>
                {assignment.notes && (
                  <p className="mt-3 text-sm italic text-muted-foreground">{assignment.notes}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <p className="font-medium">No assignments found</p>
            <p className="mt-1">Assignments will appear here when created.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
