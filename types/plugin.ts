export type Platform = 'obsidian' | 'vscode' | 'firefox' | 'jetbrains' | 'sublime' | 'atom' | 'vim' | 'homeassistant' | 'wordpress' | 'minecraft' | 'other';

export interface Contributor {
  login: string;
  contributions: number;
  avatar_url: string;
  html_url: string;
}

export interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body?: string;
}

export interface LanguageDistribution {
  [language: string]: number; // bytes of code
}

export interface GovernanceFiles {
  hasContributingGuide: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasLicense: boolean;
}

export interface Dependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface CommitActivity {
  totalCommits?: number;
  commitFrequency?: number; // commits per week (last 52 weeks average)
  recentActivity?: number[]; // last 4 weeks
}

export interface HealthMetrics {
  issueCloseRate?: number; // percentage of issues that get closed
  avgIssueCloseTimeDays?: number; // average days to close an issue
  avgPRMergeTimeDays?: number; // average days to merge a PR
  maintenanceScore?: number; // 0-100 score based on activity
  responseRate?: number; // percentage of issues with responses
}

export interface FundingLink {
  platform: string;
  url: string;
}

export interface GitHubStats {
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
  
  // Dependencies (from package.json)
  dependencies?: Dependencies;
  buildScripts?: string[];
  
  // CI/CD
  hasWorkflows?: boolean;
  workflowCount?: number;
  
  // Sponsorship
  fundingLinks?: FundingLink[];
  
  // Health Metrics
  healthMetrics?: HealthMetrics;
  
  // New enhanced data
  recentCommits?: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }>;
  tags?: Array<{
    name: string;
    sha: string;
    zipball_url: string;
    tarball_url: string;
  }>;
  tagsCount?: number;
  communityProfile?: {
    healthPercentage: number;
    description: string | null;
    documentation: string | null;
    files: any;
  };
  codeFrequency?: {
    recentWeeks: Array<{
      week: string;
      additions: number;
      deletions: number;
    }>;
    totalAdditions: number;
    totalDeletions: number;
  };
  participation?: {
    allCommits: number[];
    ownerCommits: number[];
    communityCommits: number[];
    ownerPercentage: number;
  };
  stargazersSample?: {
    sample: Array<{
      user: string;
      starred_at: string;
    }>;
    recentStars30Days: number;
    recentStars90Days: number;
    sampleSize: number;
  };
  
  // README content
  readme?: string;
}

export interface BasePlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  platform: Platform;
  branch?: string;
  authorUrl?: string;
  fundingUrl?: string;
  githubStats?: GitHubStats; // GitHub statistics (Phase 2)
  githubDataFetchedAt?: string; // ISO timestamp of when GitHub data was last fetched
}

// Minecraft-specific plugin interface
export interface MinecraftPlugin extends BasePlugin {
  platform: 'minecraft';
  contentType?: 'mod' | 'resourcepack' | 'datapack' | 'shader' | 'modpack' | 'plugin';
  modType?: 'client' | 'server' | 'both'; // client-side mod, server plugin, or both
  loader?: 'fabric' | 'forge' | 'quilt' | 'spigot' | 'paper' | 'bukkit'; // mod loader or server platform
  minecraftVersions?: string[]; // supported Minecraft versions
  downloadCount?: number; // total downloads
  rating?: number; // average rating
  ratingCount?: number; // number of ratings
  categories?: string[]; // mod/plugin categories
  tags?: string[]; // additional tags
  source?: 'modrinth' | 'curseforge' | 'spiget'; // primary source platform
  sources?: ('modrinth' | 'curseforge' | 'spiget')[]; // all platforms where this plugin exists (for deduplication)
  sourceId?: string; // ID on the source platform
  downloadUrl?: string; // direct download URL
  projectUrl?: string; // project page URL
  publishedDate?: string; // when it was first published
  lastUpdated?: string; // when it was last updated
}

// Legacy type for Obsidian plugins
export interface ObsidianPlugin extends BasePlugin {
  platform: 'obsidian';
}

export interface PluginData {
  plugins: BasePlugin[];
  lastUpdated: string;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  obsidian: 'Obsidian',
  vscode: 'VS Code',
  firefox: 'Firefox',
  jetbrains: 'JetBrains',
  sublime: 'Sublime Text',
  atom: 'Atom',
  vim: 'Vim/Neovim',
  homeassistant: 'Home Assistant',
  wordpress: 'WordPress',
  minecraft: 'Minecraft',
  other: 'Other',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  obsidian: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  vscode: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  firefox: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  jetbrains: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  sublime: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  atom: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vim: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  homeassistant: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  wordpress: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  minecraft: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

