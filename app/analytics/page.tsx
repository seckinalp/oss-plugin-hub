import { getAnalyticsData } from '@/utils/analytics';
import { PLATFORM_CONFIG } from '@/config/platforms';
import Link from 'next/link';

export const metadata = {
  title: 'Analytics - OSS Plugin Hub',
  description: 'Comprehensive analytics and insights across 9 plugin ecosystems',
};

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`;
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/" 
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-2 inline-block"
              >
                ← Back to Plugins
              </Link>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                📊 Ecosystem Analytics
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Comprehensive insights across {data.aggregate.platformCount} plugin ecosystems • Top 100 plugins with GitHub data per platform
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        
        {/* Aggregate Stats */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            📈 Overall Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Plugins"
              value={formatNumber(data.aggregate.totalPlugins)}
              subtitle="Across all platforms"
              icon="📦"
            />
            <StatCard
              label="Top-Tier Analyzed"
              value={data.aggregate.totalTop100.toString()}
              subtitle="100 per platform"
              icon="⭐"
            />
            <StatCard
              label="Total GitHub Stars"
              value={formatNumber(data.aggregate.totalStars)}
              subtitle="Community engagement"
              icon="🌟"
            />
            <StatCard
              label="Total Downloads"
              value={formatNumber(data.aggregate.totalDownloads)}
              subtitle="6.1 billion installs"
              icon="⬇️"
            />
            <StatCard
              label="Avg Stars/Plugin"
              value={formatNumber(data.aggregate.avgStarsPerPlugin)}
              subtitle="Top 100 average"
              icon="📊"
            />
            <StatCard
              label="Avg Downloads/Plugin"
              value={formatNumber(data.aggregate.avgDownloadsPerPlugin)}
              subtitle="Top 100 average"
              icon="📈"
            />
            <StatCard
              label="Open Issues"
              value={formatNumber(data.aggregate.totalIssues)}
              subtitle="Maintenance indicators"
              icon="🔧"
            />
            <StatCard
              label="Total Forks"
              value={formatNumber(data.aggregate.totalForks)}
              subtitle="Derivative projects"
              icon="🔱"
            />
          </div>
        </section>

        {/* Key Insights */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            💡 Key Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InsightCard
              title="Star Concentration Paradox"
              description="Smaller ecosystems achieve dramatically higher engagement"
              icon="🎯"
            >
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Highest: {PLATFORM_CONFIG[data.insights.starConcentrationParadox.highest.platform as keyof typeof PLATFORM_CONFIG].label}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {formatNumber(data.insights.starConcentrationParadox.highest.stars)} ⭐
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Lowest: {PLATFORM_CONFIG[data.insights.starConcentrationParadox.lowest.platform as keyof typeof PLATFORM_CONFIG].label}
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    {formatNumber(data.insights.starConcentrationParadox.lowest.stars)} ⭐
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {data.insights.starConcentrationParadox.ratio.toFixed(1)}× difference
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Quality trumps quantity in community engagement
                  </p>
                </div>
              </div>
            </InsightCard>

            <InsightCard
              title="Download Concentration"
              description="Extreme market concentration in top platforms"
              icon="📥"
            >
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    #{1} {PLATFORM_CONFIG[data.insights.downloadConcentration.top1.platform as keyof typeof PLATFORM_CONFIG].label}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatPercentage(data.insights.downloadConcentration.top1.percentage)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    #{2} {PLATFORM_CONFIG[data.insights.downloadConcentration.top2.platform as keyof typeof PLATFORM_CONFIG].label}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatPercentage(data.insights.downloadConcentration.top2.percentage)}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatPercentage(data.insights.downloadConcentration.top2Combined)} combined
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Winner-take-all market dynamics
                  </p>
                </div>
              </div>
            </InsightCard>

            <InsightCard
              title="Browser vs IDE Engagement"
              description="Browser extensions show higher community investment"
              icon="🌐"
            >
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Browser Extensions
                  </span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    {formatNumber(data.insights.browserVsIDE.browserAvg)} ⭐
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    IDE Plugins
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    {formatNumber(data.insights.browserVsIDE.ideAvg)} ⭐
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {data.insights.browserVsIDE.ratio.toFixed(1)}× higher
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Broader user base drives engagement
                  </p>
                </div>
              </div>
            </InsightCard>

            <InsightCard
              title="Platform Scale Categories"
              description="Ecosystem size inversely correlates with engagement"
              icon="📏"
            >
              <div className="space-y-2 mt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Massive (&gt;20K): {data.insights.scaleCategories.massive.count} platforms
                  </span>
                  <span className="font-semibold">{formatNumber(data.insights.scaleCategories.massive.avgStars)}⭐</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Large (5K-20K): {data.insights.scaleCategories.large.count} platforms
                  </span>
                  <span className="font-semibold">{formatNumber(data.insights.scaleCategories.large.avgStars)}⭐</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Medium (2K-5K): {data.insights.scaleCategories.medium.count} platforms
                  </span>
                  <span className="font-semibold">{formatNumber(data.insights.scaleCategories.medium.avgStars)}⭐</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Boutique (&lt;2K): {data.insights.scaleCategories.boutique.count} platform
                  </span>
                  <span className="font-semibold">{formatNumber(data.insights.scaleCategories.boutique.avgStars)}⭐</span>
                </div>
              </div>
            </InsightCard>
          </div>
        </section>

        {/* Platform Breakdown */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            🏗️ Platform Breakdown
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Plugins
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Avg Stars
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Avg Downloads
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Issue Density
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.platforms.map((platform) => {
                    const config = PLATFORM_CONFIG[platform.platform as keyof typeof PLATFORM_CONFIG];
                    return (
                      <tr key={platform.platform} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{config.icon}</span>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {config.label}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {platform.top100Count} top plugins
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                            {platform.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900 dark:text-white font-medium">
                          {formatNumber(platform.totalPlugins)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                            {formatNumber(platform.avgStars)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatNumber(platform.avgDownloads)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            {platform.issueDensity.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Category Analysis */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            📊 By Category
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {['IDE', 'Browser', 'Gaming', 'CMS', 'Specialized'].map((category) => {
              const categoryPlatforms = data.platforms.filter(p => p.category === category);
              const avgStars = categoryPlatforms.reduce((sum, p) => sum + p.avgStars, 0) / categoryPlatforms.length;
              const totalPlugins = categoryPlatforms.reduce((sum, p) => sum + p.totalPlugins, 0);
              
              return (
                <div key={category} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {category}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Platforms</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {categoryPlatforms.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Plugins</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatNumber(totalPlugins)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Avg Stars</p>
                      <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                        {formatNumber(avgStars)} ⭐
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon }: { label: string; value: string; subtitle: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function InsightCard({ title, description, icon, children }: { 
  title: string; 
  description: string; 
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

