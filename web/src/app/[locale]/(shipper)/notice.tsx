// NexCargo I-4 §5 — plain "this is not available" notice.
// Used by the shipment pages when a row is absent, foreign, or in a lifecycle state that does not
// permit the requested action. No error is thrown: the shipper is told where they stand.

import Link from 'next/link';

export function Notice({
  href,
  label,
  title,
  body,
}: {
  href: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        href={href}
        className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
      >
        ← {label}
      </Link>
      <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{title}</h1>
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
