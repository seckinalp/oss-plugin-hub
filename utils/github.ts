/**
 * GitHub API utilities for fetching repository statistics
 */

const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';

export interface GitHubRepoStats {
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  lastUpdated: string;
  createdAt: string;
  license: string | null;
  homepage: string | null;
  topics: string[];
  language: string | null;
  size: number;
  defaultBranch: string;
  archived: boolean;
  disabled: boolean;
  hasWiki: boolean;
  hasPages: boolean;
  description: string | null;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

/**
 * Fetch repository statistics from GitHub API
 */
export async function fetchRepoStats(owner: string, repo: string): Promise<GitHubRepoStats | null> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    // Add token if available
    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`GitHub API error for ${owner}/${repo}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssues: data.open_issues_count || 0,
      watchers: data.watchers_count || 0,
      lastUpdated: data.pushed_at || data.updated_at,
      createdAt: data.created_at,
      license: data.license?.name || null,
      homepage: data.homepage || null,
      topics: data.topics || [],
      language: data.language || null,
      size: data.size || 0,
      defaultBranch: data.default_branch || 'main',
      archived: data.archived || false,
      disabled: data.disabled || false,
      hasWiki: data.has_wiki || false,
      hasPages: data.has_pages || false,
      description: data.description || null,
    };
  } catch (error) {
    console.error(`Error fetching stats for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Fetch README content for a repository
 */
export async function fetchReadme(owner: string, repo: string, branch: string = 'main'): Promise<string | null> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3.raw',
    };

    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    // Try main branch first, then master
    const branches = [branch, 'main', 'master'];
    
    for (const branchName of branches) {
      const response = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/readme?ref=${branchName}`,
        { headers, next: { revalidate: 3600 } }
      );

      if (response.ok) {
        return await response.text();
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching README for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Check GitHub API rate limit
 */
export async function checkRateLimit(): Promise<RateLimitInfo | null> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}/rate_limit`, { headers });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const core = data.resources.core;

    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: core.reset,
      used: core.used,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return null;
  }
}

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

