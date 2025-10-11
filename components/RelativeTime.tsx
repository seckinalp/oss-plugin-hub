'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/utils/github';

interface RelativeTimeProps {
  dateString: string;
  className?: string;
}

export default function RelativeTime({ dateString, className }: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder during SSR to avoid hydration mismatch
    return <span className={className}>...</span>;
  }

  return <span className={className}>{formatRelativeTime(dateString)}</span>;
}

