export type Platform = 'obsidian' | 'vscode' | 'jetbrains' | 'sublime' | 'atom' | 'vim' | 'other';

export interface GitHubStats {
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
  github?: GitHubStats; // GitHub statistics (Phase 2)
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
  jetbrains: 'JetBrains',
  sublime: 'Sublime Text',
  atom: 'Atom',
  vim: 'Vim/Neovim',
  other: 'Other',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  obsidian: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  vscode: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  jetbrains: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  sublime: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  atom: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vim: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

