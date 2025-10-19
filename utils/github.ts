/**
 * GitHub API utilities for fetching repository statistics
 */

import type { 
  Contributor, 
  Release, 
  LanguageDistribution, 
  GovernanceFiles, 
  Dependencies, 
  CommitActivity,
  FundingLink 
} from '@/types/plugin';

const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';

export interface GitHubRepoStats {
  // Basic metrics
  stars: number;
  forks: number;
  openIssues: number;
  closedIssues?: number;
  openPullRequests?: number;
  closedPullRequests?: number;
  watchers: number;
  lastUpdated: string;
  createdAt: string;
  
  // Repository info
  license: string | null;
  homepage: string | null;
  topics: string[];
  language: string | null;
  languageDistribution?: LanguageDistribution;
  size: number;
  defaultBranch: string;
  archived: boolean;
  disabled: boolean;
  hasWiki: boolean;
  hasPages: boolean;
  description: string | null;
  
  // Release information
  releaseCount?: number;
  currentVersion?: string;
  latestReleaseDate?: string;
  latestRelease?: Release;
  
  // Contributors
  totalContributors?: number;
  topContributors?: Contributor[];
  
  // Commit activity
  commitActivity?: CommitActivity;
  
  // Governance
  governance?: GovernanceFiles;
  
  // Dependencies
  dependencies?: Dependencies;
  buildScripts?: string[];
  
  // CI/CD
  hasWorkflows?: boolean;
  workflowCount?: number;
  
  // Sponsorship
  fundingLinks?: FundingLink[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

/**
 * Get headers for GitHub API requests
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (GH_TOKEN) {
    headers['Authorization'] = `token ${GH_TOKEN}`;
  }

  return headers;
}

/**
 * Fetch releases from GitHub API
 */
export async function fetchReleases(owner: string, repo: string): Promise<{ releases: Release[]; count: number; latest: Release | null }> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return { releases: [], count: 0, latest: null };

    const data = await response.json();
    const releases = data.map((r: any) => ({
      tag_name: r.tag_name,
      name: r.name || r.tag_name,
      published_at: r.published_at,
      html_url: r.html_url,
      body: r.body
    }));

    return {
      releases,
      count: releases.length,
      latest: releases[0] || null
    };
  } catch (error) {
    console.error(`Error fetching releases for ${owner}/${repo}:`, error);
    return { releases: [], count: 0, latest: null };
  }
}

/**
 * Fetch contributors from GitHub API
 */
export async function fetchContributors(owner: string, repo: string): Promise<{ total: number; top: Contributor[] }> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=10`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return { total: 0, top: [] };

    const data = await response.json();
    const contributors = data.map((c: any) => ({
      login: c.login,
      contributions: c.contributions,
      avatar_url: c.avatar_url,
      html_url: c.html_url
    }));

    return {
      total: contributors.length,
      top: contributors.slice(0, 5)
    };
  } catch (error) {
    console.error(`Error fetching contributors for ${owner}/${repo}:`, error);
    return { total: 0, top: [] };
  }
}

/**
 * Fetch commit activity from GitHub API
 */
export async function fetchCommitActivity(owner: string, repo: string): Promise<CommitActivity | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const totalCommits = data.reduce((sum: number, week: any) => sum + week.total, 0);
    const avgCommitsPerWeek = Math.round(totalCommits / data.length);
    const recentActivity = data.slice(-4).map((week: any) => week.total);

    return {
      totalCommits,
      commitFrequency: avgCommitsPerWeek,
      recentActivity
    };
  } catch (error) {
    console.error(`Error fetching commit activity for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Fetch language distribution from GitHub API
 */
export async function fetchLanguageDistribution(owner: string, repo: string): Promise<LanguageDistribution | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching language distribution for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Check if a file exists in the repository
 */
async function fileExists(owner: string, repo: string, path: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch governance files status
 */
export async function fetchGovernance(owner: string, repo: string): Promise<GovernanceFiles> {
  const [hasContributing, hasCodeOfConduct, hasSecurity, hasLicense] = await Promise.all([
    fileExists(owner, repo, 'CONTRIBUTING.md').catch(() => fileExists(owner, repo, '.github/CONTRIBUTING.md')),
    fileExists(owner, repo, 'CODE_OF_CONDUCT.md').catch(() => fileExists(owner, repo, '.github/CODE_OF_CONDUCT.md')),
    fileExists(owner, repo, 'SECURITY.md').catch(() => fileExists(owner, repo, '.github/SECURITY.md')),
    fileExists(owner, repo, 'LICENSE').catch(() => fileExists(owner, repo, 'LICENSE.md'))
  ]);

  return {
    hasContributingGuide: hasContributing,
    hasCodeOfConduct: hasCodeOfConduct,
    hasSecurityPolicy: hasSecurity,
    hasLicense: hasLicense
  };
}

/**
 * Fetch and parse package.json for dependencies
 */
export async function fetchDependencies(owner: string, repo: string): Promise<{ deps: Dependencies | null; scripts: string[] }> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/package.json`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return { deps: null, scripts: [] };

    const text = await response.text();
    const packageJson = JSON.parse(text);

    const deps: Dependencies = {
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      peerDependencies: packageJson.peerDependencies
    };

    const scripts = packageJson.scripts ? Object.keys(packageJson.scripts).filter(
      (s: string) => s.includes('build') || s.includes('compile')
    ) : [];

    return { deps, scripts };
  } catch (error) {
    return { deps: null, scripts: [] };
  }
}

/**
 * Fetch CI/CD workflows
 */
export async function fetchWorkflows(owner: string, repo: string): Promise<{ hasWorkflows: boolean; count: number }> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/.github/workflows`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return { hasWorkflows: false, count: 0 };

    const data = await response.json();
    const workflowFiles = Array.isArray(data) ? data.filter((f: any) => 
      f.name.endsWith('.yml') || f.name.endsWith('.yaml')
    ) : [];

    return {
      hasWorkflows: workflowFiles.length > 0,
      count: workflowFiles.length
    };
  } catch (error) {
    return { hasWorkflows: false, count: 0 };
  }
}

/**
 * Fetch funding information
 */
export async function fetchFunding(owner: string, repo: string): Promise<FundingLink[]> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/.github/FUNDING.yml`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return [];

    const text = await response.text();
    const fundingLinks: FundingLink[] = [];

    // Parse FUNDING.yml (simple parsing)
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, platform, value] = match;
        const username = value.trim().replace(/['"]/g, '');
        
        let url = '';
        switch (platform.toLowerCase()) {
          case 'github':
            url = `https://github.com/sponsors/${username}`;
            break;
          case 'patreon':
            url = `https://patreon.com/${username}`;
            break;
          case 'open_collective':
            url = `https://opencollective.com/${username}`;
            break;
          case 'ko_fi':
            url = `https://ko-fi.com/${username}`;
            break;
          case 'tidelift':
            url = `https://tidelift.com/funding/github/${username}`;
            break;
          case 'custom':
            url = username;
            break;
          default:
            url = username;
        }

        fundingLinks.push({ platform: platform.toLowerCase(), url });
      }
    }

    return fundingLinks;
  } catch (error) {
    return [];
  }
}

/**
 * Fetch closed issues count using search API
 */
export async function fetchClosedIssuesCount(owner: string, repo: string): Promise<number> {
  try {
    const response = await fetch(
      `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`,
      {
        headers: getHeaders(),
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    return data.total_count || 0;
  } catch (error) {
    console.error(`Error fetching closed issues for ${owner}/${repo}:`, error);
    return 0;
  }
}

/**
 * Fetch pull request counts using search API
 */
export async function fetchPRCounts(owner: string, repo: string): Promise<{ open: number; closed: number }> {
  try {
    const [openResponse, closedResponse] = await Promise.all([
      fetch(
        `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:open&per_page=1`,
        { headers: getHeaders(), next: { revalidate: 3600 } }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:closed&per_page=1`,
        { headers: getHeaders(), next: { revalidate: 3600 } }
      )
    ]);

    const openData = openResponse.ok ? await openResponse.json() : { total_count: 0 };
    const closedData = closedResponse.ok ? await closedResponse.json() : { total_count: 0 };

    return {
      open: openData.total_count || 0,
      closed: closedData.total_count || 0
    };
  } catch (error) {
    console.error(`Error fetching PR counts for ${owner}/${repo}:`, error);
    return { open: 0, closed: 0 };
  }
}

/**
 * Fetch comprehensive repository statistics from GitHub API
 */
export async function fetchRepoStats(owner: string, repo: string, comprehensive: boolean = false): Promise<GitHubRepoStats | null> {
  try {
    const headers = getHeaders();

    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`GitHub API error for ${owner}/${repo}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    const basicStats: GitHubRepoStats = {
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

    // If comprehensive data is requested, fetch additional information
    if (comprehensive) {
      const [
        releases,
        contributors,
        commitActivity,
        languageDistribution,
        governance,
        dependencies,
        workflows,
        funding,
        closedIssues,
        prCounts
      ] = await Promise.all([
        fetchReleases(owner, repo),
        fetchContributors(owner, repo),
        fetchCommitActivity(owner, repo),
        fetchLanguageDistribution(owner, repo),
        fetchGovernance(owner, repo),
        fetchDependencies(owner, repo),
        fetchWorkflows(owner, repo),
        fetchFunding(owner, repo),
        fetchClosedIssuesCount(owner, repo),
        fetchPRCounts(owner, repo)
      ]);

      return {
        ...basicStats,
        releaseCount: releases.count,
        currentVersion: releases.latest?.tag_name,
        latestReleaseDate: releases.latest?.published_at,
        latestRelease: releases.latest || undefined,
        totalContributors: contributors.total,
        topContributors: contributors.top,
        commitActivity: commitActivity || undefined,
        languageDistribution: languageDistribution || undefined,
        governance,
        dependencies: dependencies.deps || undefined,
        buildScripts: dependencies.scripts,
        hasWorkflows: workflows.hasWorkflows,
        workflowCount: workflows.count,
        fundingLinks: funding,
        closedIssues,
        openPullRequests: prCounts.open,
        closedPullRequests: prCounts.closed
      };
    }

    return basicStats;
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

