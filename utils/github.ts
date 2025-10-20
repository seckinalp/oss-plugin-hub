/**
 * GitHub utility functions for the Next.js app
 * Note: Data fetching is done by scripts/update-github-stats.js
 * This file only contains helper/formatter functions used at runtime
 */

/**
 * Parse repository string into owner and repo
 */
export function parseRepo(repoString: string): { owner: string; repo: string } | null {
  const parts = repoString.split('/');
  if (parts.length !== 2) {
    return null;
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Get health status based on last update date
 */
export function getPluginHealth(lastUpdated: string): {
  status: 'active' | 'maintained' | 'stale' | 'inactive' | 'archived';
  label: string;
  color: string;
  textColor: string;
} {
  const now = new Date();
  const updated = new Date(lastUpdated);
  const daysSince = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince < 30) {
    return {
      status: 'active',
      label: 'Active',
      color: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200'
    };
  }

  if (daysSince < 180) {
    return {
      status: 'maintained',
      label: 'Maintained',
      color: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200'
    };
  }

  if (daysSince < 365) {
    return {
      status: 'stale',
      label: 'Stale',
      color: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200'
    };
  }

  return {
    status: 'inactive',
    label: 'Inactive',
    color: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200'
  };
}

/**
 * Format large numbers with k/m suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}
