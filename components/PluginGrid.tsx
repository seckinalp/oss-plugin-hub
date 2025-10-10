'use client';

import { useState, useMemo } from 'react';
import { BasePlugin, Platform, PLATFORM_LABELS } from '@/types/plugin';
import PluginCard from './PluginCard';
import SearchBar from './SearchBar';
import { exportAsJSON, exportAsSQL, exportAsCSV } from '@/utils/export';

interface PluginGridProps {
  plugins: BasePlugin[];
  lastUpdated?: string;
}

export default function PluginGrid({ plugins, lastUpdated }: PluginGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'author'>('name');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');

  // Get available platforms from the data
  const availablePlatforms = useMemo(() => {
    const platforms = new Set(plugins.map(p => p.platform));
    return Array.from(platforms).sort();
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

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return a.author.localeCompare(b.author);
      }
    });

    return filtered;
  }, [plugins, searchQuery, sortBy, selectedPlatform]);

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
              {filteredPlugins.length} of {plugins.length} plugins
              {lastUpdated && (
                <span className="ml-2">
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
              onChange={(e) => setSortBy(e.target.value as 'name' | 'author')}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="name">Name</option>
              <option value="author">Author</option>
            </select>
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

      {/* Plugin Grid */}
      {filteredPlugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      ) : (
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
            Try adjusting your search query
          </p>
        </div>
      )}
    </div>
  );
}

