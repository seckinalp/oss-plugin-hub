import { getPlatformAnalytics } from '@/utils/platform-analytics';
import { PLATFORM_CONFIG, SUPPORTED_PLATFORMS, type SupportedPlatform } from '@/config/platforms';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return SUPPORTED_PLATFORMS.map((platform) => ({
    platform: platform,
  }));
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export default async function PlatformAnalyticsPage({ params }: { params: { platform: string } }) {
  const platform = params.platform as SupportedPlatform;
  
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    notFound();
  }
  
  const data = await getPlatformAnalytics(platform);
  
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">No Data Available</h1>
          <Link href="/analytics" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Back to Analytics
          </Link>
        </div>
      </div>
    );
  }
  
  const config = PLATFORM_CONFIG[platform];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/analytics" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-2 inline-block">
            ← Back to All Platforms
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{config.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {config.label} Analytics
              </h1>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Deep dive into top {data.pluginCount} plugins with GitHub data
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        
        {/* Key Metrics */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">📊 Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Stars" value={formatNumber(data.totalStars)} icon="⭐" />
            <MetricCard label="Total Downloads" value={formatNumber(data.totalDownloads)} icon="⬇️" />
            <MetricCard label="Total Forks" value={formatNumber(data.totalForks)} icon="🔱" />
            <MetricCard label="Open Issues" value={formatNumber(data.totalIssues)} icon="🔧" />
            <MetricCard label="Avg Stars" value={formatNumber(data.avgStars)} icon="📊" />
            <MetricCard label="Avg Downloads" value={formatNumber(data.avgDownloads)} icon="📈" />
            <MetricCard label="Median Stars" value={formatNumber(data.medianStars)} icon="📉" />
            <MetricCard label="Issue Density" value={data.issueDensity.toFixed(3)} icon="🎯" />
          </div>
        </section>

        {/* Star Distribution */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">⭐ Star Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Most Starred</h3>
              <a 
                href={`https://github.com/${data.maxStars.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-slate-50 dark:hover:bg-slate-700 p-3 rounded-lg transition"
              >
                <div className="font-semibold text-slate-900 dark:text-white mb-1">{data.maxStars.name}</div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatNumber(data.maxStars.stars)} ⭐
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono">
                  {data.maxStars.repo}
                </div>
              </a>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Average</h3>
              <div className="p-3">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                  {formatNumber(data.avgStars)} ⭐
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Median: {formatNumber(data.medianStars)}
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Least Starred</h3>
              <a 
                href={`https://github.com/${data.minStars.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-slate-50 dark:hover:bg-slate-700 p-3 rounded-lg transition"
              >
                <div className="font-semibold text-slate-900 dark:text-white mb-1">{data.minStars.name}</div>
                <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                  {formatNumber(data.minStars.stars)} ⭐
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono">
                  {data.minStars.repo}
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Most Downloaded */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">🔥 Most Downloaded</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <a 
              href={`https://github.com/${data.maxDownloads.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-slate-50 dark:hover:bg-slate-700 p-4 rounded-lg transition"
            >
              <div className="font-semibold text-xl text-slate-900 dark:text-white mb-2">{data.maxDownloads.name}</div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatNumber(data.maxDownloads.downloads)} downloads
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-mono">
                {data.maxDownloads.repo}
              </div>
            </a>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Languages */}
          {data.topLanguages.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">💻 Top Languages</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <div className="space-y-4">
                  {data.topLanguages.map((lang, index) => (
                    <div key={lang.language}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {index + 1}. {lang.language}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {lang.count} plugins ({lang.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all"
                          style={{ width: `${lang.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Top Licenses */}
          {data.topLicenses.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">📜 Top Licenses</h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <div className="space-y-4">
                  {data.topLicenses.map((license, index) => (
                    <div key={license.license}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {index + 1}. {license.license}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {license.count} plugins ({license.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all"
                          style={{ width: `${license.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Most Active */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">🚀 Most Active Projects</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Plugin</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Stars</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Forks</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.mostActive.slice(0, 10).map((plugin, index) => (
                    <tr key={plugin.repo} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <a 
                          href={`https://github.com/${plugin.repo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {plugin.name}
                        </a>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{plugin.repo}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-yellow-600 dark:text-yellow-400">
                        {formatNumber(plugin.stars)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                        {formatNumber(plugin.forks)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatNumber(plugin.stars + plugin.forks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Recently Updated */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">🔄 Recently Updated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.recentlyUpdated.slice(0, 10).map((plugin, index) => (
              <a
                key={plugin.repo}
                href={`https://github.com/${plugin.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-slate-800 rounded-xl shadow p-4 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">#{index + 1}</span>
                    <div className="font-semibold text-slate-900 dark:text-white">{plugin.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">{plugin.repo}</div>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {formatDate(plugin.lastUpdated)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Top Topics */}
        {data.topTopics.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">🏷️ Popular Topics</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <div className="flex flex-wrap gap-3">
                {data.topTopics.map(topic => (
                  <div 
                    key={topic.topic}
                    className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full"
                  >
                    <span className="font-semibold">{topic.topic}</span>
                    <span className="ml-2 text-sm opacity-75">({topic.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

