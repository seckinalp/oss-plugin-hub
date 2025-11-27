'use client';

import { useMemo, useState } from 'react';
import { PLATFORM_CONFIG } from '@/config/platforms';
import type { AnalyticsData, PlatformMetrics } from '@/utils/analytics';

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

type Aggregate = {
  totalTop100: number;
  totalStars: number;
  totalDownloads: number;
  totalIssues: number;
  totalForks: number;
  avgStarsPerPlugin: number;
  avgDownloadsPerPlugin: number;
  platformCount: number;
};

type DerivedInsights = {
  starConcentration?: { highest: PlatformMetrics; lowest: PlatformMetrics; ratio: number };
  downloadConcentration?: { top1: PlatformMetrics; top2?: PlatformMetrics; combined: number };
  browserVsIDE?: { browserAvg: number; ideAvg: number; ratio: number };
};

type AggregatedDistributions = {
  languages: Array<{ name: string; count: number; percentage: number }>;
  licenses: Array<{ name: string; count: number; percentage: number }>;
  topics: Array<{ name: string; count: number; percentage: number }>;
};

function computeAggregates(selected: PlatformMetrics[]): { aggregate: Aggregate; insights: DerivedInsights; distributions: AggregatedDistributions } {
  const aggregate: Aggregate = {
    totalTop100: selected.reduce((s, p) => s + p.top100Count, 0),
    totalStars: selected.reduce((s, p) => s + p.totalStars, 0),
    totalDownloads: selected.reduce((s, p) => s + p.totalDownloads, 0),
    totalIssues: selected.reduce((s, p) => s + p.totalIssues, 0),
    totalForks: selected.reduce((s, p) => s + p.totalForks, 0),
    avgStarsPerPlugin: 0,
    avgDownloadsPerPlugin: 0,
    platformCount: selected.length,
  };

  aggregate.avgStarsPerPlugin = aggregate.totalTop100 > 0 ? aggregate.totalStars / aggregate.totalTop100 : 0;
  aggregate.avgDownloadsPerPlugin = aggregate.totalTop100 > 0 ? aggregate.totalDownloads / aggregate.totalTop100 : 0;

  const insights: DerivedInsights = {};
  const distributions: AggregatedDistributions = { languages: [], licenses: [], topics: [] };

  if (selected.length > 0) {
    const byStars = [...selected].sort((a, b) => b.avgStars - a.avgStars);
    insights.starConcentration = {
      highest: byStars[0],
      lowest: byStars[byStars.length - 1],
      ratio: byStars[0].avgStars && byStars[byStars.length - 1].avgStars
        ? byStars[0].avgStars / byStars[byStars.length - 1].avgStars
        : 0,
    };

    const byDownloads = [...selected].sort((a, b) => b.totalDownloads - a.totalDownloads);
    const top1 = byDownloads[0];
    const top2 = byDownloads[1];
    const combined = aggregate.totalDownloads > 0 && top1
      ? ((top1.totalDownloads + (top2?.totalDownloads || 0)) / aggregate.totalDownloads) * 100
      : 0;
    insights.downloadConcentration = { top1, top2, combined };

    const browsers = selected.filter(p => p.category === 'Browser');
    const ides = selected.filter(p => p.category === 'IDE');
    const browserAvg = browsers.length ? browsers.reduce((s, p) => s + p.avgStars, 0) / browsers.length : 0;
    const ideAvg = ides.length ? ides.reduce((s, p) => s + p.avgStars, 0) / ides.length : 0;
    insights.browserVsIDE = {
      browserAvg,
      ideAvg,
      ratio: ideAvg > 0 ? browserAvg / ideAvg : 0,
    };

    const sumCounts = (field: 'languageCounts' | 'licenseCounts' | 'topicCounts') => {
      const counts: Record<string, number> = {};
      selected.forEach(p => {
        p[field].forEach(item => {
          counts[item.name] = (counts[item.name] || 0) + item.count;
        });
      });
      return counts;
    };

    const totalPlugins = aggregate.totalTop100 || 1;
    const toSortedArray = (counts: Record<string, number>) =>
      Object.entries(counts)
        .map(([name, count]) => ({ name, count, percentage: (count / totalPlugins) * 100 }))
        .sort((a, b) => b.count - a.count);

    distributions.languages = toSortedArray(sumCounts('languageCounts')).slice(0, 10);
    distributions.licenses = toSortedArray(sumCounts('licenseCounts')).slice(0, 10);
    distributions.topics = toSortedArray(sumCounts('topicCounts')).slice(0, 10);
  }

  return { aggregate, insights, distributions };
}

export default function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(data.platforms.map(p => p.platform)));

  const platforms = data.platforms;

  const selectedPlatforms = useMemo(
    () => platforms.filter(p => selected.has(p.platform)),
    [platforms, selected]
  );

  const { aggregate, insights, distributions } = useMemo(
    () => computeAggregates(selectedPlatforms),
    [selectedPlatforms]
  );

  const togglePlatform = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(platforms.map(p => p.platform)));
  const clearAll = () => setSelected(new Set());

  return (
    <div className="space-y-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics Playground</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Combine any subset of platforms (default: all 900 plugins across 9 ecosystems).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => {
            const active = selected.has(p.platform);
            const cfg = PLATFORM_CONFIG[p.platform as keyof typeof PLATFORM_CONFIG];
            return (
              <button
                key={p.platform}
                onClick={() => togglePlatform(p.platform)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
                }`}
              >
                <span className="text-lg">{cfg.icon}</span>
                <span className="font-medium">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Platforms" value={aggregate.platformCount.toString()} subtitle="Selected ecosystems" />
          <StatCard label="Top Plugins" value={aggregate.totalTop100.toString()} subtitle="Top-100 per platform" />
          <StatCard label="Total Stars" value={formatNumber(aggregate.totalStars)} subtitle="Selected slice" />
          <StatCard label="Total Downloads" value={formatNumber(aggregate.totalDownloads)} subtitle="Selected slice" />
          <StatCard label="Total Issues" value={formatNumber(aggregate.totalIssues)} subtitle="Open issues" />
          <StatCard label="Total Forks" value={formatNumber(aggregate.totalForks)} subtitle="Community forks" />
          <StatCard label="Avg Stars / Plugin" value={formatNumber(aggregate.avgStarsPerPlugin)} subtitle="Mean across selection" />
          <StatCard label="Avg Downloads / Plugin" value={formatNumber(aggregate.avgDownloadsPerPlugin)} subtitle="Mean across selection" />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Research Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Avg Governance Score" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgGovernanceScore || 0), 0) / (selectedPlatforms.length || 1))} subtitle="0-4 maturity" />
          <StatCard label="Avg Core Team Ratio" value={(selectedPlatforms.reduce((s, p) => s + (p.avgCoreTeamRatio || 0), 0) / (selectedPlatforms.length || 1)).toFixed(3)} subtitle="Top3 commits / total" />
          <StatCard label="Issue Efficiency" value={(selectedPlatforms.reduce((s, p) => s + (p.avgIssueEfficiency || 0), 0) / (selectedPlatforms.length || 1)).toFixed(3)} subtitle="Closed / total" />
          <StatCard label="Abandonment Rate" value={`${((selectedPlatforms.reduce((s, p) => s + (p.avgAbandonmentRate || 0), 0) / (selectedPlatforms.length || 1)) * 100).toFixed(1)}%`} subtitle="No commits in 12 months" />
          <StatCard label="Star Concentration" value={(selectedPlatforms.reduce((s, p) => s + (p.avgStarConcentration || 0), 0) / (selectedPlatforms.length || 1)).toFixed(2)} subtitle="Stars / log10(size)" />
          <StatCard label="Owner % of Commits" value={`${(selectedPlatforms.reduce((s, p) => s + (p.avgOwnerShare || 0), 0) / (selectedPlatforms.length || 1)).toFixed(1)}%`} subtitle="Owner share (12w)" />
          <StatCard label="Avg Prod Deps" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgProdDeps || 0), 0) / (selectedPlatforms.length || 1))} subtitle="Dependencies" />
          <StatCard label="Avg Dev Deps" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgDevDeps || 0), 0) / (selectedPlatforms.length || 1))} subtitle="Dev dependencies" />
          <StatCard label="Workflows" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgWorkflowCount || 0), 0) / (selectedPlatforms.length || 1))} subtitle="CI pipelines" />
          <StatCard label="Commit Freq" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgCommitFrequency || 0), 0) / (selectedPlatforms.length || 1))} subtitle="Commits/week" />
          <StatCard label="Repo Size (KB)" value={formatNumber(selectedPlatforms.reduce((s, p) => s + (p.avgRepoSize || 0), 0) / (selectedPlatforms.length || 1))} subtitle="Avg repository size" />
          <StatCard label="Stale Dep Ratio" value={`${(selectedPlatforms.reduce((s, p) => s + (p.avgStaleDepRatio || 0), 0) / (selectedPlatforms.length || 1)).toFixed(2)}`} subtitle="Older than 1 year (placeholder)" />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightCard title="Star Concentration" description="Highest vs lowest avg stars">
            {insights.starConcentration ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>{PLATFORM_CONFIG[insights.starConcentration.highest.platform as keyof typeof PLATFORM_CONFIG].label}</span>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                    {formatNumber(insights.starConcentration.highest.avgStars)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>{PLATFORM_CONFIG[insights.starConcentration.lowest.platform as keyof typeof PLATFORM_CONFIG].label}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    {formatNumber(insights.starConcentration.lowest.avgStars)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Ratio: {insights.starConcentration.ratio.toFixed(1)}×
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
            )}
          </InsightCard>

          <InsightCard title="Download Concentration" description="Share held by top 2 platforms">
            {insights.downloadConcentration?.top1 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{PLATFORM_CONFIG[insights.downloadConcentration.top1.platform as keyof typeof PLATFORM_CONFIG].label}</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {insights.downloadConcentration.top1.totalDownloads > 0 && aggregate.totalDownloads > 0
                      ? `${((insights.downloadConcentration.top1.totalDownloads / aggregate.totalDownloads) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
                {insights.downloadConcentration.top2 && (
                  <div className="flex justify-between">
                    <span>{PLATFORM_CONFIG[insights.downloadConcentration.top2.platform as keyof typeof PLATFORM_CONFIG].label}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {insights.downloadConcentration.top2.totalDownloads > 0 && aggregate.totalDownloads > 0
                        ? `${((insights.downloadConcentration.top2.totalDownloads / aggregate.totalDownloads) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Combined: {insights.downloadConcentration.combined.toFixed(1)}%
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
            )}
          </InsightCard>

          <InsightCard title="Browser vs IDE" description="Avg stars per plugin">
            {insights.browserVsIDE ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Browsers</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {formatNumber(insights.browserVsIDE.browserAvg)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>IDEs</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    {formatNumber(insights.browserVsIDE.ideAvg)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Ratio: {insights.browserVsIDE.ratio.toFixed(1)}×
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
            )}
          </InsightCard>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Language & License Distribution</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Top Languages">
            <div className="space-y-3">
              {distributions.languages.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
              )}
              {distributions.languages.map((lang, idx) => (
                <ProgressRow
                  key={lang.name}
                  label={`${idx + 1}. ${lang.name}`}
                  value={`${lang.count} plugins (${lang.percentage.toFixed(1)}%)`}
                  percent={lang.percentage}
                />
              ))}
            </div>
          </Panel>
          <Panel title="Top Licenses">
            <div className="space-y-3">
              {distributions.licenses.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
              )}
              {distributions.licenses.map((lic, idx) => (
                <ProgressRow
                  key={lic.name}
                  label={`${idx + 1}. ${lic.name}`}
                  value={`${lic.count} plugins (${lic.percentage.toFixed(1)}%)`}
                  percent={lic.percentage}
                />
              ))}
            </div>
          </Panel>
          <Panel title="Top Topics">
            <div className="space-y-3">
              {distributions.topics.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one platform.</p>
              )}
              {distributions.topics.map((t, idx) => (
                <ProgressRow
                  key={t.name}
                  label={`${idx + 1}. ${t.name}`}
                  value={`${t.count} repos (${t.percentage.toFixed(1)}%)`}
                  percent={t.percentage}
                />
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Platform Breakdown</h3>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Avg Stars</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Avg Downloads</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Issue Density</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Avg Forks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {selectedPlatforms.map((p) => {
                  const cfg = PLATFORM_CONFIG[p.platform as keyof typeof PLATFORM_CONFIG];
                  return (
                    <tr key={p.platform} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{cfg.icon}</span>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{cfg.label}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Top {p.top100Count} plugins</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">{p.category}</td>
                      <td className="px-6 py-3 text-right font-semibold text-yellow-600 dark:text-yellow-400">
                        {formatNumber(p.avgStars)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                        {formatNumber(p.avgDownloads)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {p.issueDensity.toFixed(3)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {formatNumber(p.avgForks)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

function InsightCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{description}</p>
      {children}
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
