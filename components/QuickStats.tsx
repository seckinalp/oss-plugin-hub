import { getAnalyticsData } from '@/utils/analytics';
import Link from 'next/link';

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

export default async function QuickStats() {
  try {
    const data = await getAnalyticsData();

    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            📊 Quick Stats
          </h2>
          <Link
            href="/analytics"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            View Full Analytics →
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(data.aggregate.totalPlugins)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Total Plugins
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatNumber(data.aggregate.totalStars)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              GitHub Stars
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatNumber(data.aggregate.totalDownloads)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Downloads
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.aggregate.platformCount}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Platforms
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
                Key Finding
              </h3>
              <p className="text-xs text-indigo-800 dark:text-indigo-300">
                Smaller ecosystems achieve <strong>{data.insights.starConcentrationParadox.ratio.toFixed(1)}×</strong> higher 
                community engagement than massive platforms, challenging conventional wisdom about network effects.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading quick stats:', error);
    return null;
  }
}

