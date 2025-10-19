import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import { BasePlugin } from '@/types/plugin';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/types/plugin';
import { parseRepo, fetchReadme, getPluginHealth, formatNumber } from '@/utils/github';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelativeTime from '@/components/RelativeTime';

// Generate static paths for all plugins
export async function generateStaticParams() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'plugins.json');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    return data.plugins.map((plugin: BasePlugin) => ({
      id: plugin.id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

async function getPlugin(id: string): Promise<BasePlugin | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'plugins.json');
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    const plugin = data.plugins.find((p: BasePlugin) => p.id === id);
    
    if (!plugin) {
      return null;
    }

    // Use only cached data from plugins.json
    // The cron job keeps data fresh automatically
    return plugin;
  } catch (error) {
    console.error('Error loading plugin:', error);
    return null;
  }
}

export default async function PluginPage({ params }: { params: { id: string } }) {
  const plugin = await getPlugin(params.id);

  if (!plugin) {
    notFound();
  }

  const platformLabel = PLATFORM_LABELS[plugin.platform];
  const platformColor = PLATFORM_COLORS[plugin.platform];

  // Fetch README
  let readme: string | null = null;
  if (plugin.repo) {
    const parsed = parseRepo(plugin.repo);
    if (parsed) {
      readme = await fetchReadme(parsed.owner, parsed.repo, plugin.branch || plugin.github?.defaultBranch);
    }
  }

  // Get health status
  const health = plugin.github ? getPluginHealth(plugin.github.lastUpdated) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm mb-2 inline-block">
            ← Back to all plugins
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {plugin.name}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {plugin.description}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            {plugin.github && (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                    Repository Statistics
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNumber(plugin.github.stars)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">⭐ Stars</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNumber(plugin.github.forks)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">🍴 Forks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {plugin.github.openIssues}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">🐛 Open Issues</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNumber(plugin.github.watchers)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">👀 Watchers</div>
                    </div>
                  </div>
                  
                  {/* Additional Stats Row */}
                  {(plugin.github.closedIssues || plugin.github.openPullRequests || plugin.github.closedPullRequests || plugin.github.totalContributors) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      {plugin.github.closedIssues !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatNumber(plugin.github.closedIssues)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">✅ Closed Issues</div>
                        </div>
                      )}
                      {plugin.github.openPullRequests !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatNumber(plugin.github.openPullRequests)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">🔄 Open PRs</div>
                        </div>
                      )}
                      {plugin.github.closedPullRequests !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {formatNumber(plugin.github.closedPullRequests)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">✔️ Closed PRs</div>
                        </div>
                      )}
                      {plugin.github.totalContributors !== undefined && plugin.github.totalContributors > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {formatNumber(plugin.github.totalContributors)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">👥 Contributors</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Releases */}
                {plugin.github.latestRelease && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Latest Release
                    </h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                            {plugin.github.latestRelease.name}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Version {plugin.github.currentVersion}
                          </p>
                        </div>
                        <a
                          href={plugin.github.latestRelease.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                        >
                          View Release →
                        </a>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Released <RelativeTime dateString={plugin.github.latestReleaseDate!} />
                      </p>
                      {plugin.github.releaseCount && plugin.github.releaseCount > 1 && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {plugin.github.releaseCount} total releases
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Contributors */}
                {plugin.github.topContributors && plugin.github.topContributors.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Top Contributors
                    </h2>
                    <div className="space-y-3">
                      {plugin.github.topContributors.map((contributor) => (
                        <a
                          key={contributor.login}
                          href={contributor.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Image
                            src={contributor.avatar_url}
                            alt={contributor.login}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {contributor.login}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {contributor.contributions} contributions
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commit Activity */}
                {plugin.github.commitActivity && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Commit Activity
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {plugin.github.commitActivity.totalCommits && (
                        <div>
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {formatNumber(plugin.github.commitActivity.totalCommits)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Total Commits (52 weeks)
                          </div>
                        </div>
                      )}
                      {plugin.github.commitActivity.commitFrequency && (
                        <div>
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {plugin.github.commitActivity.commitFrequency}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Commits/Week (Average)
                          </div>
                        </div>
                      )}
                    </div>
                    {plugin.github.commitActivity.recentActivity && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Recent Activity (Last 4 Weeks)
                        </p>
                        <div className="flex gap-2">
                          {plugin.github.commitActivity.recentActivity.map((count, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-slate-100 dark:bg-slate-700 rounded"
                              style={{ height: `${Math.max(20, Math.min(100, count * 2))}px` }}
                              title={`Week ${i + 1}: ${count} commits`}
                            >
                              <div className="w-full h-full bg-indigo-500 rounded flex items-end justify-center">
                                <span className="text-xs text-white mb-1">{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Language Distribution */}
                {plugin.github.languageDistribution && Object.keys(plugin.github.languageDistribution).length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Language Distribution
                    </h2>
                    <div className="space-y-3">
                      {(() => {
                        const total = Object.values(plugin.github.languageDistribution!).reduce((a, b) => a + b, 0);
                        return Object.entries(plugin.github.languageDistribution!)
                          .sort(([, a], [, b]) => b - a)
                          .map(([lang, bytes]) => {
                            const percentage = ((bytes / total) * 100).toFixed(1);
                            return (
                              <div key={lang}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-slate-900 dark:text-white">{lang}</span>
                                  <span className="text-slate-600 dark:text-slate-400">{percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                  <div
                                    className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {plugin.github.dependencies && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Dependencies
                    </h2>
                    <div className="space-y-4">
                      {plugin.github.dependencies.dependencies && Object.keys(plugin.github.dependencies.dependencies).length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Production Dependencies ({Object.keys(plugin.github.dependencies.dependencies).length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(plugin.github.dependencies.dependencies).slice(0, 10).map(([name, version]) => (
                              <span
                                key={name}
                                className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                              >
                                {name}@{version}
                              </span>
                            ))}
                            {Object.keys(plugin.github.dependencies.dependencies).length > 10 && (
                              <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">
                                +{Object.keys(plugin.github.dependencies.dependencies).length - 10} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {plugin.github.dependencies.devDependencies && Object.keys(plugin.github.dependencies.devDependencies).length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Dev Dependencies ({Object.keys(plugin.github.dependencies.devDependencies).length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(plugin.github.dependencies.devDependencies).slice(0, 10).map(([name, version]) => (
                              <span
                                key={name}
                                className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs"
                              >
                                {name}@{version}
                              </span>
                            ))}
                            {Object.keys(plugin.github.dependencies.devDependencies).length > 10 && (
                              <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">
                                +{Object.keys(plugin.github.dependencies.devDependencies).length - 10} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Health Metrics */}
                {plugin.github.healthMetrics && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      📊 Project Health Metrics
                    </h2>
                    
                    {/* Maintenance Score */}
                    {plugin.github.healthMetrics.maintenanceScore !== undefined && (
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Maintenance Score
                          </span>
                          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {plugin.github.healthMetrics.maintenanceScore}/100
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full ${
                              plugin.github.healthMetrics.maintenanceScore >= 80 ? 'bg-green-500' :
                              plugin.github.healthMetrics.maintenanceScore >= 60 ? 'bg-yellow-500' :
                              plugin.github.healthMetrics.maintenanceScore >= 40 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${plugin.github.healthMetrics.maintenanceScore}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Based on issue resolution, PR activity, and community engagement
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Issue Close Rate */}
                      {plugin.github.healthMetrics.issueCloseRate !== undefined && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Issue Close Rate
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {plugin.github.healthMetrics.issueCloseRate}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round((plugin.github.healthMetrics.issueCloseRate / 100) * ((plugin.github.openIssues || 0) + (plugin.github.closedIssues || 0)))} of {(plugin.github.openIssues || 0) + (plugin.github.closedIssues || 0)} issues resolved
                          </div>
                        </div>
                      )}

                      {/* Average Issue Close Time */}
                      {plugin.github.healthMetrics.avgIssueCloseTimeDays !== undefined && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Avg Issue Close Time
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {plugin.github.healthMetrics.avgIssueCloseTimeDays} days
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Based on last 30 closed issues
                          </div>
                        </div>
                      )}

                      {/* Average PR Merge Time */}
                      {plugin.github.healthMetrics.avgPRMergeTimeDays !== undefined && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Avg PR Merge Time
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {plugin.github.healthMetrics.avgPRMergeTimeDays} days
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Based on recent merged PRs
                          </div>
                        </div>
                      )}

                      {/* Response Rate */}
                      {plugin.github.healthMetrics.responseRate !== undefined && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Response Rate
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {plugin.github.healthMetrics.responseRate}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Issues receiving responses
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Governance & Quality */}
                {plugin.github.governance && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      Repository Health
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className={plugin.github.governance.hasLicense ? 'text-green-600' : 'text-slate-400'}>
                          {plugin.github.governance.hasLicense ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">License</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={plugin.github.governance.hasContributingGuide ? 'text-green-600' : 'text-slate-400'}>
                          {plugin.github.governance.hasContributingGuide ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Contributing Guide</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={plugin.github.governance.hasCodeOfConduct ? 'text-green-600' : 'text-slate-400'}>
                          {plugin.github.governance.hasCodeOfConduct ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Code of Conduct</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={plugin.github.governance.hasSecurityPolicy ? 'text-green-600' : 'text-slate-400'}>
                          {plugin.github.governance.hasSecurityPolicy ? '✅' : '❌'}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Security Policy</span>
                      </div>
                      {plugin.github.hasWorkflows !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={plugin.github.hasWorkflows ? 'text-green-600' : 'text-slate-400'}>
                            {plugin.github.hasWorkflows ? '✅' : '❌'}
                          </span>
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            CI/CD Workflows {plugin.github.workflowCount ? `(${plugin.github.workflowCount})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Trending - Star Growth */}
                {plugin.github?.stargazersSample && plugin.github.stargazersSample.recentStars30Days > 0 && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg shadow-md p-6 border border-orange-200 dark:border-orange-800">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      🔥 Trending
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                          +{formatNumber(plugin.github.stargazersSample.recentStars30Days)}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Stars (Last 30 Days)
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                          +{formatNumber(plugin.github.stargazersSample.recentStars90Days)}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Stars (Last 90 Days)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Community Health Score */}
                {plugin.github?.communityProfile && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      💚 Community Health Score
                    </h2>
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Overall Health
                        </span>
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {plugin.github.communityProfile.healthPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full transition-all ${
                            plugin.github.communityProfile.healthPercentage >= 80 ? 'bg-green-500' :
                            plugin.github.communityProfile.healthPercentage >= 60 ? 'bg-yellow-500' :
                            plugin.github.communityProfile.healthPercentage >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${plugin.github.communityProfile.healthPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Based on documentation, community files, and project governance
                      </p>
                    </div>
                  </div>
                )}

                {/* Participation - Owner vs Community */}
                {plugin.github?.participation && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      👥 Contribution Distribution
                    </h2>
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Owner</span>
                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {plugin.github.participation.ownerPercentage}%
                        </span>
                      </div>
                      <div className="flex h-6 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${plugin.github.participation.ownerPercentage}%` }}
                        >
                          {plugin.github.participation.ownerPercentage > 15 && 'Owner'}
                        </div>
                        <div
                          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${100 - plugin.github.participation.ownerPercentage}%` }}
                        >
                          {100 - plugin.github.participation.ownerPercentage > 15 && 'Community'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Community</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {100 - plugin.github.participation.ownerPercentage}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last 12 weeks of commit activity
                    </p>
                  </div>
                )}

                {/* Code Frequency */}
                {plugin.github?.codeFrequency && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      📊 Code Activity (Last 12 Weeks)
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          +{formatNumber(plugin.github.codeFrequency.totalAdditions)}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Lines Added
                        </div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          -{formatNumber(plugin.github.codeFrequency.totalDeletions)}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Lines Removed
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 items-end h-32">
                      {plugin.github.codeFrequency.recentWeeks.map((week, i) => {
                        const total = week.additions + week.deletions;
                        const maxHeight = Math.max(...plugin.github.codeFrequency!.recentWeeks.map(w => w.additions + w.deletions));
                        const height = maxHeight > 0 ? (total / maxHeight) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col justify-end items-center gap-0.5">
                            <div
                              className="w-full bg-green-500 rounded-t"
                              style={{ height: `${(week.additions / total) * height}%` }}
                              title={`Week ${i + 1}: +${week.additions}`}
                            />
                            <div
                              className="w-full bg-red-500 rounded-b"
                              style={{ height: `${(week.deletions / total) * height}%` }}
                              title={`Week ${i + 1}: -${week.deletions}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Commits */}
                {plugin.github?.recentCommits && plugin.github.recentCommits.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      📝 Recent Commits
                    </h2>
                    <div className="space-y-3">
                      {plugin.github.recentCommits.slice(0, 5).map((commit) => (
                        <a
                          key={commit.sha}
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
                        >
                          <div className="flex items-start gap-3">
                            <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                              {commit.sha}
                            </code>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900 dark:text-white font-medium truncate">
                                {commit.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{commit.author}</span>
                                <span>•</span>
                                <RelativeTime dateString={commit.date} />
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {plugin.github?.tags && plugin.github.tags.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                      🏷️ Version Tags ({plugin.github.tagsCount})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {plugin.github.tags.slice(0, 15).map((tag) => (
                        <a
                          key={tag.name}
                          href={tag.zipball_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-200 dark:border-slate-600"
                          title={`Download ${tag.name}`}
                        >
                          <span>{tag.name}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </a>
                      ))}
                      {plugin.github.tagsCount && plugin.github.tagsCount > 15 && (
                        <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-sm">
                          +{plugin.github.tagsCount - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* README */}
            {readme && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                  README
                </h2>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {readme}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {!readme && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  README not available. Visit the repository for more information.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Plugin Info */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Information
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-slate-600 dark:text-slate-400">Author</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-white">
                    {plugin.author}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600 dark:text-slate-400">Platform</dt>
                  <dd>
                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${platformColor}`}>
                      {platformLabel}
                    </span>
                  </dd>
                </div>
                {plugin.github?.license && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">License</dt>
                    <dd className="text-sm font-medium text-slate-900 dark:text-white">
                      {plugin.github.license}
                    </dd>
                  </div>
                )}
                {plugin.github?.language && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">Language</dt>
                    <dd className="text-sm font-medium text-slate-900 dark:text-white">
                      {plugin.github.language}
                    </dd>
                  </div>
                )}
                {plugin.github && (
                  <>
                    <div>
                      <dt className="text-sm text-slate-600 dark:text-slate-400">Last Updated</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-white">
                        <RelativeTime dateString={plugin.github.lastUpdated} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600 dark:text-slate-400">Created</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-white" suppressHydrationWarning>
                        {new Date(plugin.github.createdAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </>
                )}
                {health && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">Status</dt>
                    <dd>
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${health.color} ${health.textColor}`}>
                        {health.label}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Links */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Links
              </h3>
              <div className="space-y-2">
                <a
                  href={`https://github.com/${plugin.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
                {plugin.github?.homepage && (
                  <a
                    href={plugin.github.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Homepage
                  </a>
                )}
                {plugin.fundingUrl && (
                  <a
                    href={plugin.fundingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Support Author
                  </a>
                )}
              </div>
            </div>

            {/* Funding/Sponsorship */}
            {plugin.github?.fundingLinks && plugin.github.fundingLinks.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  💝 Support this Project
                </h3>
                <div className="space-y-2">
                  {plugin.github.fundingLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {link.platform.charAt(0).toUpperCase() + link.platform.slice(1).replace('_', ' ')}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {plugin.github?.topics && plugin.github.topics.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {plugin.github.topics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

