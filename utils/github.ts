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
  
  // Health Metrics
  healthMetrics?: {
    issueCloseRate?: number;
    avgIssueCloseTimeDays?: number;
    avgPRMergeTimeDays?: number;
    maintenanceScore?: number;
    responseRate?: number;
  };
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
 * Calculate health metrics including issue close rate, response times, etc.
 */
export async function fetchHealthMetrics(owner: string, repo: string, openIssues: number, closedIssues: number, openPRs: number, closedPRs: number): Promise<any> {
  try {
    // Calculate issue close rate
    const totalIssues = openIssues + closedIssues;
    const issueCloseRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;

    // Fetch recent closed issues to calculate average close time
    const recentClosedIssuesResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues?state=closed&sort=updated&direction=desc&per_page=30`,
      { headers: getHeaders(), next: { revalidate: 3600 } }
    );

    let avgIssueCloseTimeDays = 0;
    let avgPRMergeTimeDays = 0;

    if (recentClosedIssuesResponse.ok) {
      const recentClosed = await recentClosedIssuesResponse.json();
      
      // Separate issues and PRs
      const issues = recentClosed.filter((item: any) => !item.pull_request);
      const prs = recentClosed.filter((item: any) => item.pull_request);

      // Calculate average issue close time
      if (issues.length > 0) {
        const issueTimes = issues.map((issue: any) => {
          const created = new Date(issue.created_at).getTime();
          const closed = new Date(issue.closed_at).getTime();
          return (closed - created) / (1000 * 60 * 60 * 24); // Convert to days
        });
        avgIssueCloseTimeDays = Math.round(issueTimes.reduce((a: number, b: number) => a + b, 0) / issueTimes.length);
      }

      // Calculate average PR merge time
      if (prs.length > 0) {
        const prTimes = prs.map((pr: any) => {
          const created = new Date(pr.created_at).getTime();
          const closed = new Date(pr.closed_at).getTime();
          return (closed - created) / (1000 * 60 * 60 * 24); // Convert to days
        });
        avgPRMergeTimeDays = Math.round(prTimes.reduce((a: number, b: number) => a + b, 0) / prTimes.length);
      }
    }

    // Calculate maintenance score (0-100)
    // Based on: issue close rate (40%), recent activity (30%), PR merge rate (30%)
    const prTotal = openPRs + closedPRs;
    const prMergeRate = prTotal > 0 ? (closedPRs / prTotal) * 100 : 0;
    
    const maintenanceScore = Math.round(
      (issueCloseRate * 0.4) + 
      (Math.min(issueCloseRate, 100) * 0.3) + 
      (prMergeRate * 0.3)
    );

    return {
      issueCloseRate,
      avgIssueCloseTimeDays: avgIssueCloseTimeDays > 0 ? avgIssueCloseTimeDays : undefined,
      avgPRMergeTimeDays: avgPRMergeTimeDays > 0 ? avgPRMergeTimeDays : undefined,
      maintenanceScore: Math.min(maintenanceScore, 100),
      responseRate: issueCloseRate // Simplified - could be enhanced with comment data
    };
  } catch (error) {
    console.error(`Error calculating health metrics for ${owner}/${repo}:`, error);
    return {
      issueCloseRate: 0,
      maintenanceScore: 0
    };
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
        prCounts,
        recentCommits,
        tags,
        communityProfile,
        codeFrequency,
        participation,
        stargazersSample
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
        fetchPRCounts(owner, repo),
        fetchRecentCommits(owner, repo),
        fetchTags(owner, repo),
        fetchCommunityProfile(owner, repo),
        fetchCodeFrequency(owner, repo),
        fetchParticipation(owner, repo),
        fetchStargazersSample(owner, repo)
      ]);

      // Calculate health metrics after we have issue/PR counts
      const healthMetrics = await fetchHealthMetrics(
        owner, 
        repo, 
        basicStats.openIssues, 
        closedIssues, 
        prCounts.open, 
        prCounts.closed
      );

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
        closedPullRequests: prCounts.closed,
        healthMetrics,
        recentCommits: recentCommits || undefined,
        tags: tags || undefined,
        tagsCount: tags?.length || 0,
        communityProfile: communityProfile || undefined,
        codeFrequency: codeFrequency || undefined,
        participation: participation || undefined,
        stargazersSample: stargazersSample || undefined
      };
    }

    return basicStats;
  } catch (error) {
    console.error(`Error fetching stats for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Fetch recent commits
 */
export async function fetchRecentCommits(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=10`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((commit: any) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch tags
 */
export async function fetchTags(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/tags?per_page=20`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((tag: any) => ({
      name: tag.name,
      sha: tag.commit.sha.substring(0, 7),
      zipball_url: tag.zipball_url,
      tarball_url: tag.tarball_url
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch community profile
 */
export async function fetchCommunityProfile(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/community/profile`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3+json' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      healthPercentage: data.health_percentage,
      description: data.description,
      documentation: data.documentation,
      files: data.files
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch code frequency stats
 */
export async function fetchCodeFrequency(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/code_frequency`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const recent = data.slice(-12);
    const totalAdditions = recent.reduce((sum: number, week: any) => sum + week[1], 0);
    const totalDeletions = recent.reduce((sum: number, week: any) => sum + Math.abs(week[2]), 0);

    return {
      recentWeeks: recent.map((week: any) => ({
        week: new Date(week[0] * 1000).toISOString(),
        additions: week[1],
        deletions: Math.abs(week[2])
      })),
      totalAdditions,
      totalDeletions
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch participation stats
 */
export async function fetchParticipation(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/participation`, {
      headers: getHeaders(),
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.all) return null;

    const recentAll = data.all.slice(-12);
    const recentOwner = data.owner.slice(-12);
    
    return {
      allCommits: recentAll,
      ownerCommits: recentOwner,
      communityCommits: recentAll.map((all: number, i: number) => all - recentOwner[i]),
      ownerPercentage: Math.round((recentOwner.reduce((a: number, b: number) => a + b, 0) / recentAll.reduce((a: number, b: number) => a + b, 0)) * 100) || 0
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch stargazers with timestamps (sample for trending)
 */
export async function fetchStargazersSample(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stargazers?per_page=100`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.star+json' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const recentStars = data.filter((s: any) => new Date(s.starred_at) > thirtyDaysAgo).length;
    const last90DaysStars = data.filter((s: any) => new Date(s.starred_at) > ninetyDaysAgo).length;

    return {
      sample: data.slice(0, 10).map((s: any) => ({
        user: s.user.login,
        starred_at: s.starred_at
      })),
      recentStars30Days: recentStars,
      recentStars90Days: last90DaysStars,
      sampleSize: data.length
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch README content for a repository
 */
export async function fetchReadme(owner: string, repo: string, branch?: string): Promise<string | null> {
  try {
    const headers = getHeaders();

    // First try without specifying branch (let GitHub find the default README)
    let response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      { 
        headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' },
        next: { revalidate: 3600 } 
      }
    );

    if (response.ok) {
      return await response.text();
    }

    // If that fails and we have a branch, try with the branch
    if (branch) {
      response = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/readme?ref=${branch}`,
        { 
          headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' },
          next: { revalidate: 3600 } 
        }
      );

      if (response.ok) {
        return await response.text();
      }
    }

    console.log(`README not found for ${owner}/${repo}`);
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

