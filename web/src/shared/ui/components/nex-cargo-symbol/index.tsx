'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '../../utils';

interface NexCargoSymbolProps {
  href?: string;
  className?: string;
}

export function NexCargoSymbol({
  href = '/',
  className,
}: NexCargoSymbolProps) {
  return (
    <Link
      href={href}
      className={cn('shrink-0 inline-flex items-center', className)}
      aria-label="NexCargo"
    >
      <Image
        src="/assets/brand/symbol/nexcargo-symbol.svg"
        alt="NexCargo"
        width={32}
        height={32}
        className="h-8 w-auto"
        priority
        unoptimized
      />
    </Link>
  );
}
