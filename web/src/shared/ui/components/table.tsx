// NexCargo — Table Component
// C6-III Shipper Dashboard Primitives Layer
// Implements Table per PROMPT 5 specification
// Features: pagination, sorting, filtering placeholder, row selection placeholder, skeleton loading
// Complies with ESS-008 §5.2 (mandatory standard component) + §9 (skeleton loaders)

import React from 'react';
import { cn } from '../utils';
import { Spinner } from './spinner';
import { Skeleton } from './skeleton';

export interface Column<T extends Record<string, unknown> = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  className?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface TableProps<T = unknown> extends Omit<React.HTMLAttributes<HTMLTableElement>, 'onSort'> {
  columns: Column<Record<string, unknown>>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  selectedRows?: Set<string>;
  rowKey?: (row: T) => string;
  onRowSelect?: (rowId: string, selected: boolean) => void;
  onRowsSelect?: (selectedIds: Set<string>) => void;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
  striped?: boolean;
  hoverable?: boolean;
  ariaPreviousLabel?: string;
  ariaNextLabel?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({
    className,
    columns,
    data,
    isLoading = false,
    emptyMessage = 'No records found.',
    onSort,
    sortKey,
    sortDirection,
    selectable = false,
    selectedRows,
    rowKey = (row: unknown) => JSON.stringify(row) as string,
    onRowSelect,
    onRowsSelect,
    pageSize,
    currentPage = 1,
    onPageChange,
    totalItems,
    striped = true,
    hoverable = true,
    ariaPreviousLabel = 'Previous page',
    ariaNextLabel = 'Next page',
    ...props
  }, ref) => {
    const displayData = pageSize && totalItems ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize) : data;
    const totalPages = pageSize && totalItems ? Math.ceil(totalItems / pageSize) : 1;
    const allSelected = displayData.length > 0 && selectedRows && displayData.every((row) => selectedRows.has(rowKey(row)));
    const someSelected = displayData.some((row) => selectedRows?.has(rowKey(row)));

    return (
      <div className={cn('w-full overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900', className)}>
        {/* Loading State */}
        {isLoading && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground dark:text-zinc-400" role="status">
            <svg className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="font-medium">{emptyMessage}</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && displayData.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table ref={ref} className="w-full text-left text-sm" {...props}>
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <tr>
                    {selectable && (
                      <th className="px-4 py-3 font-medium" scope="col">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => {
                            if (allSelected) {
                              onRowsSelect?.(new Set());
                            } else {
                              const allIds = new Set(displayData.map(rowKey));
                              onRowsSelect?.(allIds);
                            }
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
                          aria-label="Select all rows"
                        />
                      </th>
                    )}
                    {columns.map((col) => (
                      <th
                        key={String(col.key)}
                        className={cn('px-4 py-3 font-medium', col.className, col.sortable && 'cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200')}
                        scope="col"
                        onClick={() => col.sortable && onSort?.(String(col.key), sortDirection === 'asc' ? 'desc' : 'asc')}
                        {...(col.sortable ? {
                          tabIndex: 0,
                          role: 'columnheader',
                          'aria-sort': sortKey === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none',
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if ((e.key === 'Enter' || e.key === ' ') && onSort) {
                              e.preventDefault();
                              onSort(String(col.key), sortDirection === 'asc' ? 'desc' : 'asc');
                            }
                          },
                        } : {})}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {col.sortable && sortKey === col.key && (
                            <span aria-hidden="true">{sortDirection === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
                          )}
                          {col.sortable && sortKey !== col.key && (
                            <span className="opacity-0 group-hover:opacity-100" aria-hidden="true">\u25B4\u25BE</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {displayData.map((row, rowIndex) => (
                    <tr
                      key={rowKey(row)}
                      className={cn(
                        hoverable && 'transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                        striped && rowIndex % 2 === 1 && 'bg-zinc-50/50 dark:bg-zinc-800/30'
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows?.has(rowKey(row)) ?? false}
                            onChange={(e) => onRowSelect?.(rowKey(row), e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
                            aria-label={`Select row ${rowKey(row)}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={String(col.key)} className={cn('px-4 py-3', col.className)}>
                          {col.render ? col.render((row as Record<string, unknown>)[col.key], row as Record<string, unknown>) : String((row as Record<string, unknown>)[col.key] ?? '\u2014')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageSize && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <p className="text-sm text-muted-foreground dark:text-zinc-400">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems ?? 0)} of {totalItems ?? 0}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPageChange?.(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    aria-label={ariaPreviousLabel}
                  >
                    {ariaPreviousLabel}
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => onPageChange?.(page)}
                        className={cn(
                          'min-w-[2rem] rounded-md px-3 py-1 text-sm transition-colors',
                          page === currentPage
                            ? 'bg-foreground text-background dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800'
                        )}
                        aria-label={`Go to page ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onPageChange?.(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    aria-label={ariaNextLabel}
                  >
                    {ariaNextLabel}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

Table.displayName = 'Table';
