'use client';

import { useState, useMemo } from 'react';
import { ObsidianPlugin } from '@/types/plugin';
import PluginCard from './PluginCard';
import SearchBar from './SearchBar';

interface PluginGridProps {
  plugins: ObsidianPlugin[];
  lastUpdated?: string;
}

export default function PluginGrid({ plugins, lastUpdated }: PluginGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'author'>('name');

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    let filtered = plugins;

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
  }, [plugins, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Stats and Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Obsidian Plugins
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
          
          <div className="flex items-center gap-2">
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

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, author, or description..."
        />
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

