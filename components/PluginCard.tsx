import Link from 'next/link';
import { BasePlugin, PLATFORM_LABELS, PLATFORM_COLORS } from '@/types/plugin';
import { formatNumber, getPluginHealth } from '@/utils/github';
import RelativeTime from './RelativeTime';

interface PluginCardProps {
  plugin: BasePlugin;
}

export default function PluginCard({ plugin }: PluginCardProps) {
  const repoUrl = `https://github.com/${plugin.repo}`;
  const platformLabel = PLATFORM_LABELS[plugin.platform];
  const platformColor = PLATFORM_COLORS[plugin.platform];
  const health = plugin.github ? getPluginHealth(plugin.github.lastUpdated) : null;

  return (
    <Link href={`/plugin/${plugin.id}`}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-xl transition-all p-6 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              {plugin.name}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${platformColor}`}>
              {platformLabel}
            </span>
            {health && (
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${health.color} ${health.textColor}`}>
                {health.label}
              </span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
          {plugin.description}
        </p>

        {/* GitHub Stats */}
        {plugin.github && (
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              ⭐ {formatNumber(plugin.github.stars)}
            </span>
            <span className="flex items-center gap-1">
              🍴 {formatNumber(plugin.github.forks)}
            </span>
            <span className="flex items-center gap-1">
              📅 <RelativeTime dateString={plugin.github.lastUpdated} />
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            {plugin.author}
          </span>
          <span 
            onClick={(e) => {
              e.preventDefault();
              window.open(repoUrl, '_blank');
            }}
            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Repository
          </span>
        </div>
      </div>
    </Link>
  );
}

