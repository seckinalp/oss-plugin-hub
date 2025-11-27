import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlatformAnalytics } from '@/utils/platform-analytics';
import { PLATFORM_CONFIG, SUPPORTED_PLATFORMS, type SupportedPlatform } from '@/config/platforms';

export function generateStaticParams() {
  return SUPPORTED_PLATFORMS.map((platform) => ({ platform }));
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

export default async function PlatformAnalyticsPage({ params }: { params: { platform: string } }) {
  const platform = params.platform as SupportedPlatform;
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    notFound();
  }

  const data = await getPlatformAnalytics(platform);
  if (!data) {
    notFound();
  }

  const config = PLATFORM_CONFIG[platform];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-2 inline-block">
            ← Back to plugins
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {config.label} — Top 100 Analytics
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Metrics and insights for the top 100 {config.label} plugins (GitHub-hosted)
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Stars" value={formatNumber(data.totalStars)} />
          <StatCard label="Avg Stars" value={formatNumber(data.avgStars)} />
          <StatCard label="Median Stars" value={formatNumber(data.medianStars)} />
          <StatCard label="Issue Density" value={data.issueDensity.toFixed(3)} />
          <StatCard label="Total Downloads" value={formatNumber(data.totalDownloads)} />
          <StatCard label="Avg Downloads" value={formatNumber(data.avgDownloads)} />
          <StatCard label="Total Forks" value={formatNumber(data.totalForks)} />
          <StatCard label="Total Issues" value={formatNumber(data.totalIssues)} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HighlightCard
            title="Most Starred"
            primary={`${formatNumber(data.maxStars.stars)} ⭐`}
            name={data.maxStars.name}
            repo={data.maxStars.repo}
          />
          <HighlightCard
            title="Most Downloaded"
            primary={`${formatNumber(data.maxDownloads.downloads)} downloads`}
            name={data.maxDownloads.name}
            repo={data.maxDownloads.repo}
          />
          <HighlightCard
            title="High Engagement (stars/log downloads)"
            primary={`${formatNumber(data.highEngagement[0]?.stars || 0)} ⭐`}
            name={data.highEngagement[0]?.name || '—'}
            repo={data.highEngagement[0]?.repo || ''}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.topLanguages.length > 0 && (
            <Panel title="Top Languages">
              <div className="space-y-3">
                {data.topLanguages.map((lang, idx) => (
                  <ProgressRow
                    key={lang.language}
                    label={`${idx + 1}. ${lang.language}`}
                    value={`${lang.count} plugins (${lang.percentage.toFixed(1)}%)`}
                    percent={lang.percentage}
                  />
                ))}
              </div>
            </Panel>
          )}
          {data.topLicenses.length > 0 && (
            <Panel title="Top Licenses">
              <div className="space-y-3">
                {data.topLicenses.map((license, idx) => (
                  <ProgressRow
                    key={license.license}
                    label={`${idx + 1}. ${license.license}`}
                    value={`${license.count} plugins (${license.percentage.toFixed(1)}%)`}
                    percent={license.percentage}
                  />
                ))}
              </div>
            </Panel>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Most Active (Stars + Forks)">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.mostActive.slice(0, 10).map((plugin, idx) => (
                <li key={plugin.repo} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {plugin.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{plugin.repo}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-yellow-600 dark:text-yellow-400">{formatNumber(plugin.stars)} ⭐</div>
                    <div className="font-semibold text-blue-600 dark:text-blue-400">{formatNumber(plugin.forks)} forks</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recently Updated">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.recentlyUpdated.slice(0, 10).map((plugin, idx) => (
                <li key={plugin.repo} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {plugin.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{plugin.repo}</p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {formatDate(plugin.lastUpdated)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Highest Issue Density (open issues per star)">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.topIssueDensity.slice(0, 10).map((plugin, idx) => (
                <li key={plugin.repo} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {plugin.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{plugin.repo}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-rose-600 dark:text-rose-400">{plugin.openIssues} issues</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      density {plugin.density.toFixed(3)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Most Forked">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.topForked.slice(0, 10).map((plugin, idx) => (
                <li key={plugin.repo} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {plugin.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{plugin.repo}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-blue-600 dark:text-blue-400">{formatNumber(plugin.forks)} forks</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(plugin.stars)} stars</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {data.topTopics.length > 0 && (
          <section>
            <Panel title="Popular Topics">
              <div className="flex flex-wrap gap-2">
                {data.topTopics.map((topic) => (
                  <span
                    key={topic.topic}
                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs font-semibold"
                  >
                    {topic.topic} ({topic.count})
                  </span>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function HighlightCard({ title, primary, name, repo }: { title: string; primary: string; name: string; repo: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{primary}</p>
      <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 font-semibold">{name}</p>
      {repo && (
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate" title={repo}>
          {repo}
        </p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{title}</h2>
      {children}
    </div>
  );
}

function ProgressRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm text-slate-700 dark:text-slate-200">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{value}</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
        <div
          className="h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}
