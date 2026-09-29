'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '../../utils';

interface NexCargoLogoProps {
  href?: string;
  className?: string;
  variant?: 'default' | 'light' | 'dark';
  label?: string;
}

export function NexCargoLogo({
  href = '/',
  className,
  variant = 'default',
}: NexCargoLogoProps) {
  const srcMap: Record<string, string> = {
    default: '/assets/brand/logo/nexcargo-logo-no-bkgd-1298x339px.svg',
    light: '/assets/brand/logo/nexcargo-logo-light.svg',
    dark: '/assets/brand/logo/nexcargo-logo-dark.svg',
  };

  const altText = 'NexCargo';

  return (
    <Link
      href={href}
      className={cn('shrink-0 inline-flex items-center', className)}
      aria-label={altText}
    >
      <Image
        src={srcMap[variant]}
        alt={altText}
        width={220}
        height={56}
        className="h-auto max-h-[56px] w-auto"
        priority
        unoptimized
      />
    </Link>
  );
}
