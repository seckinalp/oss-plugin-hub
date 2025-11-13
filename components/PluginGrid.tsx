'use client';

import { useState, useMemo, useEffect } from 'react';
import { BasePlugin, Platform, PLATFORM_LABELS } from '@/types/plugin';
import PluginCard from './PluginCard';
import SearchBar from './SearchBar';
import { exportAsJSON, exportAsSQL, exportAsCSV } from '@/utils/export';
import { getPluginHealth } from '@/utils/github';

interface PluginGridProps {
  plugins: BasePlugin[];
  lastUpdated?: string;
}

type SortOption = 'name' | 'author' | 'stars' | 'forks' | 'updated' | 'created' | 'issues' | 'contributors';
type HealthStatus = 'all' | 'active' | 'maintained' | 'stale' | 'inactive';

export default function PluginGrid({ plugins, lastUpdated }: PluginGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // GitHub stats filters
  const [minStars, setMinStars] = useState<number>(0);
  const [minForks, setMinForks] = useState<number>(0);
  const [maxOpenIssues, setMaxOpenIssues] = useState<number>(0);
  const [minContributors, setMinContributors] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedLicense, setSelectedLicense] = useState<string>('all');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('all');
  const [showArchived, setShowArchived] = useState<boolean>(true);
  const [lastUpdatedDays, setLastUpdatedDays] = useState<number>(0);
  const [hasLicense, setHasLicense] = useState<boolean>(false);
  const [hasWiki, setHasWiki] = useState<boolean>(false);

  // Get available platforms, languages, and licenses from the data
  const availablePlatforms = useMemo(() => {
    const platforms = new Set(plugins.map(p => p.platform));
    return Array.from(platforms).sort();
  }, [plugins]);

  const availableLanguages = useMemo(() => {
    const languages = new Set(
      plugins
        .filter(p => p.githubStats?.language)
        .map(p => p.githubStats!.language!)
    );
    return Array.from(languages).sort();
  }, [plugins]);

  const availableLicenses = useMemo(() => {
    const licenses = new Set(
      plugins
        .filter(p => p.githubStats?.license)
        .map(p => p.githubStats!.license!)
    );
    return Array.from(licenses).sort();
  }, [plugins]);

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    let filtered = plugins;

    // Platform filter
    if (selectedPlatform !== 'all') {
      filtered = filtered.filter(plugin => plugin.platform === selectedPlatform);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (plugin) =>
          plugin.name.toLowerCase().includes(query) ||
          plugin.author.toLowerCase().includes(query) ||
          plugin.description.toLowerCase().includes(query)
      );
    }

    // GitHub Stats filters
    if (minStars > 0) {
      filtered = filtered.filter(plugin => (plugin.githubStats?.stars || 0) >= minStars);
    }

    if (minForks > 0) {
      filtered = filtered.filter(plugin => (plugin.githubStats?.forks || 0) >= minForks);
    }

    if (maxOpenIssues > 0) {
      filtered = filtered.filter(plugin => (plugin.githubStats?.openIssues || 0) <= maxOpenIssues);
    }

    if (minContributors > 0) {
      filtered = filtered.filter(plugin => (plugin.githubStats?.totalContributors || 0) >= minContributors);
    }

    // Language filter
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(plugin => plugin.githubStats?.language === selectedLanguage);
    }

    // License filter
    if (selectedLicense !== 'all') {
      filtered = filtered.filter(plugin => plugin.githubStats?.license === selectedLicense);
    }

    // Archived filter
    if (!showArchived) {
      filtered = filtered.filter(plugin => !plugin.githubStats?.archived);
    }

    // Last updated filter
    if (lastUpdatedDays > 0) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - lastUpdatedDays);
      filtered = filtered.filter(plugin => {
        if (!plugin.githubStats?.lastUpdated) return false;
        return new Date(plugin.githubStats.lastUpdated) >= daysAgo;
      });
    }

    // Health status filter
    if (healthStatus !== 'all') {
      filtered = filtered.filter(plugin => {
        if (!plugin.githubStats?.lastUpdated) return false;
        const health = getPluginHealth(plugin.githubStats.lastUpdated);
        return health.status === healthStatus;
      });
    }

    // Has license filter
    if (hasLicense) {
      filtered = filtered.filter(plugin => plugin.githubStats?.license !== null);
    }

    // Has wiki filter
    if (hasWiki) {
      filtered = filtered.filter(plugin => plugin.githubStats?.hasWiki === true);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return (b.githubStats?.stars || 0) - (a.githubStats?.stars || 0);
        case 'forks':
          return (b.githubStats?.forks || 0) - (a.githubStats?.forks || 0);
        case 'updated':
          if (!a.githubStats?.lastUpdated) return 1;
          if (!b.githubStats?.lastUpdated) return -1;
          return new Date(b.githubStats.lastUpdated).getTime() - new Date(a.githubStats.lastUpdated).getTime();
        case 'created':
          if (!a.githubStats?.createdAt) return 1;
          if (!b.githubStats?.createdAt) return -1;
          return new Date(b.githubStats.createdAt).getTime() - new Date(a.githubStats.createdAt).getTime();
        case 'issues':
          return (a.githubStats?.openIssues || 0) - (b.githubStats?.openIssues || 0);
        case 'contributors':
          return (b.githubStats?.totalContributors || 0) - (a.githubStats?.totalContributors || 0);
        case 'author':
          return a.author.localeCompare(b.author);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [plugins, searchQuery, sortBy, selectedPlatform, minStars, minForks, maxOpenIssues, 
      minContributors, selectedLanguage, selectedLicense, healthStatus, showArchived, 
      lastUpdatedDays, hasLicense, hasWiki]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPlugins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPlugins = filteredPlugins.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPlatform, minStars, minForks, maxOpenIssues, 
      minContributors, selectedLanguage, selectedLicense, healthStatus, showArchived, 
      lastUpdatedDays, hasLicense, hasWiki]);

  return (
    <div className="space-y-6">
      {/* Stats and Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {selectedPlatform === 'all' ? 'All Plugins' : `${PLATFORM_LABELS[selectedPlatform]} Plugins`}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredPlugins.length)} of {filteredPlugins.length} plugins
              {filteredPlugins.length < plugins.length && ` (filtered from ${plugins.length})`}
              {lastUpdated && (
                <span className="ml-2" suppressHydrationWarning>
                  • Last updated: {new Date(lastUpdated).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <label htmlFor="sort" className="text-sm text-slate-600 dark:text-slate-400">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="name">Name (A-Z)</option>
              <option value="author">Author</option>
              <option value="stars">Most Stars ⭐</option>
              <option value="forks">Most Forks 🍴</option>
              <option value="contributors">Most Contributors 👥</option>
              <option value="issues">Fewest Issues 🐛</option>
              <option value="updated">Recently Updated 📅</option>
              <option value="created">Newest 🆕</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {showFilters ? '🔽 Hide Filters' : '🔼 Show Filters'}
            </button>
          </div>
        </div>

        {/* Platform Filter */}
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
            Platform:
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedPlatform('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPlatform === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              All Platforms ({plugins.length})
            </button>
            {availablePlatforms.map((platform) => {
              const count = plugins.filter(p => p.platform === platform).length;
              return (
                <button
                  key={platform}
                  onClick={() => setSelectedPlatform(platform)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPlatform === platform
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {PLATFORM_LABELS[platform]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mb-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                🔍 Advanced Filters
              </h3>
              <button
                onClick={() => {
                  setMinStars(0);
                  setMinForks(0);
                  setMaxOpenIssues(0);
                  setMinContributors(0);
                  setSelectedLanguage('all');
                  setSelectedLicense('all');
                  setHealthStatus('all');
                  setShowArchived(true);
                  setLastUpdatedDays(0);
                  setHasLicense(false);
                  setHasWiki(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Clear All Filters
              </button>
            </div>

            <div className="space-y-5">
              {/* GitHub Stats Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  ⭐ GitHub Statistics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="minStars" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Min Stars ⭐
                    </label>
                    <input
                      id="minStars"
                      type="number"
                      min="0"
                      value={minStars}
                      onChange={(e) => setMinStars(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div>
                    <label htmlFor="minForks" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Min Forks 🍴
                    </label>
                    <input
                      id="minForks"
                      type="number"
                      min="0"
                      value={minForks}
                      onChange={(e) => setMinForks(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 50"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxOpenIssues" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Max Open Issues 🐛
                    </label>
                    <input
                      id="maxOpenIssues"
                      type="number"
                      min="0"
                      value={maxOpenIssues}
                      onChange={(e) => setMaxOpenIssues(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 20"
                    />
                  </div>
                  <div>
                    <label htmlFor="minContributors" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Min Contributors 👥
                    </label>
                    <input
                      id="minContributors"
                      type="number"
                      min="0"
                      value={minContributors}
                      onChange={(e) => setMinContributors(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Activity Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  📅 Date & Activity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lastUpdatedDays" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Updated Within (days)
                    </label>
                    <select
                      id="lastUpdatedDays"
                      value={lastUpdatedDays}
                      onChange={(e) => setLastUpdatedDays(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="0">Any time</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 3 months</option>
                      <option value="180">Last 6 months</option>
                      <option value="365">Last year</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="healthStatus" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Health Status 💚
                    </label>
                    <select
                      id="healthStatus"
                      value={healthStatus}
                      onChange={(e) => setHealthStatus(e.target.value as HealthStatus)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active (Updated &lt; 30 days)</option>
                      <option value="maintained">Maintained (&lt; 6 months)</option>
                      <option value="stale">Stale (&lt; 1 year)</option>
                      <option value="inactive">Inactive (&gt; 1 year)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Language & License Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  💻 Language & License
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="language" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      Programming Language
                    </label>
                    <select
                      id="language"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Languages</option>
                      {availableLanguages.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="license" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                      License
                    </label>
                    <select
                      id="license"
                      value={selectedLicense}
                      onChange={(e) => setSelectedLicense(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Licenses</option>
                      {availableLicenses.map(license => (
                        <option key={license} value={license}>{license}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Filters Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  ⚙️ Additional Options
                </h4>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!showArchived}
                      onChange={(e) => setShowArchived(!e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Hide Archived Projects 📦
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasLicense}
                      onChange={(e) => setHasLicense(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Has License Only ⚖️
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasWiki}
                      onChange={(e) => setHasWiki(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Has Wiki 📖
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, author, or description..."
        />

        {/* Export Options */}
        {filteredPlugins.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Export {filteredPlugins.length} filtered plugin{filteredPlugins.length !== 1 ? 's' : ''}:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportAsJSON(filteredPlugins)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  JSON
                </button>
                <button
                  onClick={() => exportAsSQL(filteredPlugins)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  SQL
                </button>
                <button
                  onClick={() => exportAsCSV(filteredPlugins)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls - Top */}
      {filteredPlugins.length > 0 && totalPages > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="itemsPerPage" className="text-sm text-slate-600 dark:text-slate-400">
                Show:
              </label>
              <select
                id="itemsPerPage"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <span className="text-sm text-slate-600 dark:text-slate-400">per page</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Prev
              </button>
              <span className="px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Grid */}
      {paginatedPlugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPlugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
            No plugins found
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try adjusting your search query or filters
          </p>
        </div>
      ) : null}

      {/* Pagination Controls - Bottom */}
      {filteredPlugins.length > 0 && totalPages > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredPlugins.length)} of {filteredPlugins.length} plugins
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCurrentPage(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Prev
              </button>
              <span className="px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => {
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next ›
              </button>
              <button
                onClick={() => {
                  setCurrentPage(totalPages);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

