import fs from 'fs';
import path from 'path';
import { SUPPORTED_PLATFORMS, type SupportedPlatform } from '@/config/platforms';

export interface PlatformMetrics {
  platform: SupportedPlatform;
  totalPlugins: number;
  top100Count: number;
  totalStars: number;
  avgStars: number;
  totalDownloads: number;
  avgDownloads: number;
  totalIssues: number;
  avgIssues: number;
  issueDensity: number;
  totalForks: number;
  avgForks: number;
  category: 'IDE' | 'Browser' | 'Gaming' | 'CMS' | 'Specialized';
  languageCounts: Array<{ name: string; count: number }>;
  licenseCounts: Array<{ name: string; count: number }>;
  topicCounts: Array<{ name: string; count: number }>;
  avgGovernanceScore: number;
  avgCoreTeamRatio: number;
  avgIssueEfficiency: number;
  avgAbandonmentRate: number;
  avgStarConcentration: number;
  avgOwnerShare: number;
  avgProdDeps: number;
  avgDevDeps: number;
  avgWorkflowCount: number;
  avgCommitFrequency: number;
  avgRepoSize: number;
  avgStaleDepRatio: number;
}

export interface AggregateMetrics {
  totalPlugins: number;
  totalTop100: number;
  totalStars: number;
  totalDownloads: number;
  totalIssues: number;
  totalForks: number;
  avgStarsPerPlugin: number;
  avgDownloadsPerPlugin: number;
  platformCount: number;
}

export interface AnalyticsData {
  platforms: PlatformMetrics[];
  aggregate: AggregateMetrics;
  insights: {
    starConcentrationParadox: {
      highest: { platform: string; stars: number };
      lowest: { platform: string; stars: number };
      ratio: number;
    };
    downloadConcentration: {
      top1: { platform: string; downloads: number; percentage: number };
      top2: { platform: string; downloads: number; percentage: number };
      top2Combined: number;
    };
    scaleCategories: {
      massive: { count: number; avgStars: number; platforms: string[] };
      large: { count: number; avgStars: number; platforms: string[] };
      medium: { count: number; avgStars: number; platforms: string[] };
      boutique: { count: number; avgStars: number; platforms: string[] };
    };
    browserVsIDE: {
      browserAvg: number;
      ideAvg: number;
      ratio: number;
    };
  };
}

const PLATFORM_CATEGORIES: Record<SupportedPlatform, 'IDE' | 'Browser' | 'Gaming' | 'CMS' | 'Specialized'> = {
  vscode: 'IDE',
  jetbrains: 'IDE',
  sublime: 'IDE',
  chrome: 'Browser',
  firefox: 'Browser',
  minecraft: 'Gaming',
  wordpress: 'CMS',
  obsidian: 'Specialized',
  homeassistant: 'Specialized',
};

function getDataPath(platform: string, filename: string): string {
  return path.join(process.cwd(), 'data', platform, filename);
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const platformMetrics: PlatformMetrics[] = [];
  
  const getStars = (p: any) => p.githubStats?.stars ?? p.stars ?? 0;
  const getForks = (p: any) => p.githubStats?.forks ?? p.forks ?? 0;
  const getIssues = (p: any) => p.githubStats?.openIssues ?? p.openIssues ?? 0;
  const getDownloads = (p: any) => p.downloads ?? 0;
  const getLanguage = (p: any) => p.githubStats?.language ?? p.language ?? 'Unknown';
  const getLicense = (p: any) => p.githubStats?.license ?? p.license ?? 'No License';
  const getTopics = (p: any) => p.githubStats?.topics ?? p.topics ?? [];
  const getClosedIssues = (p: any) => p.githubStats?.closedIssues ?? p.closedIssues ?? 0;
  const getDepCounts = (p: any) => {
    const deps = p.githubStats?.dependencies || p.dependencies || {};
    const prod = deps.dependencies ? Object.keys(deps.dependencies).length : 0;
    const dev = deps.devDependencies ? Object.keys(deps.devDependencies).length : 0;
    return { prod, dev };
  };
  const getGovernanceScore = (p: any) => {
    const gov = p.githubStats?.governance;
    if (!gov) return 0;
    return (gov.hasLicense ? 1 : 0) + (gov.hasCodeOfConduct ? 1 : 0) + (gov.hasSecurityPolicy ? 1 : 0) + (gov.hasContributingGuide ? 1 : 0);
  };
  const getCoreTeamRatio = (p: any) => {
    const top = p.githubStats?.topContributors;
    const totalCommits = p.githubStats?.commitActivity?.totalCommits ?? 0;
    if (!top || !Array.isArray(top) || totalCommits === 0) return 0;
    const top3 = top.slice(0, 3).reduce((s: number, c: any) => s + (c.contributions || 0), 0);
    return top3 / totalCommits;
  };
  const getIssueEfficiency = (p: any) => {
    const open = getIssues(p);
    const closed = getClosedIssues(p);
    const total = open + closed;
    if (total === 0) return 0;
    return closed / total; // simplified efficiency without close time
  };
  const getIsAbandoned = (p: any) => {
    const last = p.githubStats?.lastUpdated ?? p.lastUpdated;
    if (!last) return false;
    const days = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    return days > 365;
  };
  const getOwnerShare = (p: any) => p.githubStats?.participation?.ownerPercentage ?? 0;
  const getWorkflowCount = (p: any) => p.githubStats?.workflowCount ?? 0;
  const getCommitFrequency = (p: any) => p.githubStats?.commitActivity?.commitFrequency ?? 0;
  const getRepoSize = (p: any) => p.githubStats?.size ?? 0;
  const getTop100WithGithub = (platform: string): any[] => {
    try {
      const pluginsPath = getDataPath(platform, 'plugins.json');
      if (fs.existsSync(pluginsPath)) {
        const allPlugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
        if (Array.isArray(allPlugins.plugins)) {
          const top = allPlugins.plugins.filter((p: any) => p.isTop100 === true);
          if (top.length > 0) return top;
        }
      }
    } catch (e) {
      // fall back below
    }
    try {
      const top100Path = getDataPath(platform, 'top100.json');
      if (fs.existsSync(top100Path)) {
        const top100 = JSON.parse(fs.readFileSync(top100Path, 'utf8'));
        if (Array.isArray(top100.top100)) {
          return top100.top100;
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  };
  
  for (const platform of SUPPORTED_PLATFORMS) {
    try {
      const metadataPath = getDataPath(platform, 'metadata.json');
      const top100Path = getDataPath(platform, 'top100.json');
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const top100 = getTop100WithGithub(platform);
      
      const stars = top100.reduce((sum: number, p: any) => sum + getStars(p), 0);
      const downloads = top100.reduce((sum: number, p: any) => sum + getDownloads(p), 0);
      const issues = top100.reduce((sum: number, p: any) => sum + getIssues(p), 0);
      const forks = top100.reduce((sum: number, p: any) => sum + getForks(p), 0);
      const languageCount: Record<string, number> = {};
      const licenseCount: Record<string, number> = {};
      const topicCount: Record<string, number> = {};
      let governanceSum = 0;
      let coreRatioSum = 0;
      let issueEfficiencySum = 0;
      let abandonmentCount = 0;
      let starConcentrationSum = 0;
      let ownerShareSum = 0;
      let prodDepSum = 0;
      let devDepSum = 0;
      let workflowSum = 0;
      let commitFreqSum = 0;
      let repoSizeSum = 0;
      // Stale dependency ratio not available in current data; placeholder 0
      const platformSize = metadata.totalCount || top100.length || 1;
      top100.forEach((p: any) => {
        const lang = getLanguage(p);
        languageCount[lang] = (languageCount[lang] || 0) + 1;
        const lic = getLicense(p);
        licenseCount[lic] = (licenseCount[lic] || 0) + 1;
        getTopics(p).forEach((t: string) => {
          topicCount[t] = (topicCount[t] || 0) + 1;
        });
        governanceSum += getGovernanceScore(p);
        coreRatioSum += getCoreTeamRatio(p);
        issueEfficiencySum += getIssueEfficiency(p);
        if (getIsAbandoned(p)) abandonmentCount += 1;
        starConcentrationSum += getStars(p) / Math.log10(platformSize || 1);
        ownerShareSum += getOwnerShare(p);
        const deps = getDepCounts(p);
        prodDepSum += deps.prod;
        devDepSum += deps.dev;
        workflowSum += getWorkflowCount(p);
        commitFreqSum += getCommitFrequency(p);
        repoSizeSum += getRepoSize(p);
      });
      
      platformMetrics.push({
        platform,
        totalPlugins: metadata.totalCount,
        top100Count: top100.length,
        totalStars: stars,
        avgStars: top100.length > 0 ? stars / top100.length : 0,
        totalDownloads: downloads,
        avgDownloads: top100.length > 0 ? downloads / top100.length : 0,
        totalIssues: issues,
        avgIssues: top100.length > 0 ? issues / top100.length : 0,
        issueDensity: stars > 0 ? issues / stars : 0,
        totalForks: forks,
        avgForks: top100.length > 0 ? forks / top100.length : 0,
        category: PLATFORM_CATEGORIES[platform],
        languageCounts: Object.entries(languageCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        licenseCounts: Object.entries(licenseCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        topicCounts: Object.entries(topicCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        avgGovernanceScore: top100.length > 0 ? governanceSum / top100.length : 0,
        avgCoreTeamRatio: top100.length > 0 ? coreRatioSum / top100.length : 0,
        avgIssueEfficiency: top100.length > 0 ? issueEfficiencySum / top100.length : 0,
        avgAbandonmentRate: top100.length > 0 ? abandonmentCount / top100.length : 0,
        avgStarConcentration: top100.length > 0 ? starConcentrationSum / top100.length : 0,
        avgOwnerShare: top100.length > 0 ? ownerShareSum / top100.length : 0,
        avgProdDeps: top100.length > 0 ? prodDepSum / top100.length : 0,
        avgDevDeps: top100.length > 0 ? devDepSum / top100.length : 0,
        avgWorkflowCount: top100.length > 0 ? workflowSum / top100.length : 0,
        avgCommitFrequency: top100.length > 0 ? commitFreqSum / top100.length : 0,
        avgRepoSize: top100.length > 0 ? repoSizeSum / top100.length : 0,
        avgStaleDepRatio: 0, // placeholder until dependency release dates are available
      });
    } catch (error) {
      console.error(`Error loading analytics for ${platform}:`, error);
    }
  }
  
  // Calculate aggregate metrics
  const totalPlugins = platformMetrics.reduce((sum, p) => sum + p.totalPlugins, 0);
  const totalStars = platformMetrics.reduce((sum, p) => sum + p.totalStars, 0);
  const totalDownloads = platformMetrics.reduce((sum, p) => sum + p.totalDownloads, 0);
  const totalIssues = platformMetrics.reduce((sum, p) => sum + p.totalIssues, 0);
  const totalForks = platformMetrics.reduce((sum, p) => sum + p.totalForks, 0);
  const totalTop100 = platformMetrics.reduce((sum, p) => sum + p.top100Count, 0);
  
  const aggregate: AggregateMetrics = {
    totalPlugins,
    totalTop100,
    totalStars,
    totalDownloads,
    totalIssues,
    totalForks,
    avgStarsPerPlugin: totalStars / totalTop100,
    avgDownloadsPerPlugin: totalDownloads / totalTop100,
    platformCount: SUPPORTED_PLATFORMS.length,
  };
  
  // Calculate insights
  const sortedByStars = [...platformMetrics].sort((a, b) => b.avgStars - a.avgStars);
  const sortedByDownloads = [...platformMetrics].sort((a, b) => b.totalDownloads - a.totalDownloads);
  
  // Scale categories
  const massive = platformMetrics.filter(p => p.totalPlugins > 20000);
  const large = platformMetrics.filter(p => p.totalPlugins >= 5000 && p.totalPlugins <= 20000);
  const medium = platformMetrics.filter(p => p.totalPlugins >= 2000 && p.totalPlugins < 5000);
  const boutique = platformMetrics.filter(p => p.totalPlugins < 2000);
  
  // Browser vs IDE
  const browserPlatforms = platformMetrics.filter(p => p.category === 'Browser');
  const idePlatforms = platformMetrics.filter(p => p.category === 'IDE');
  const browserAvg = browserPlatforms.reduce((s, p) => s + p.avgStars, 0) / browserPlatforms.length;
  const ideAvg = idePlatforms.reduce((s, p) => s + p.avgStars, 0) / idePlatforms.length;
  
  const top2Downloads = sortedByDownloads[0].totalDownloads + sortedByDownloads[1].totalDownloads;
  
  const insights = {
    starConcentrationParadox: {
      highest: {
        platform: sortedByStars[0].platform,
        stars: sortedByStars[0].avgStars,
      },
      lowest: {
        platform: sortedByStars[sortedByStars.length - 1].platform,
        stars: sortedByStars[sortedByStars.length - 1].avgStars,
      },
      ratio: sortedByStars[0].avgStars / sortedByStars[sortedByStars.length - 1].avgStars,
    },
    downloadConcentration: {
      top1: {
        platform: sortedByDownloads[0].platform,
        downloads: sortedByDownloads[0].totalDownloads,
        percentage: (sortedByDownloads[0].totalDownloads / totalDownloads) * 100,
      },
      top2: {
        platform: sortedByDownloads[1].platform,
        downloads: sortedByDownloads[1].totalDownloads,
        percentage: (sortedByDownloads[1].totalDownloads / totalDownloads) * 100,
      },
      top2Combined: (top2Downloads / totalDownloads) * 100,
    },
    scaleCategories: {
      massive: {
        count: massive.length,
        avgStars: massive.reduce((s, p) => s + p.avgStars, 0) / massive.length,
        platforms: massive.map(p => p.platform),
      },
      large: {
        count: large.length,
        avgStars: large.reduce((s, p) => s + p.avgStars, 0) / large.length,
        platforms: large.map(p => p.platform),
      },
      medium: {
        count: medium.length,
        avgStars: medium.reduce((s, p) => s + p.avgStars, 0) / medium.length,
        platforms: medium.map(p => p.platform),
      },
      boutique: {
        count: boutique.length,
        avgStars: boutique.reduce((s, p) => s + p.avgStars, 0) / boutique.length,
        platforms: boutique.map(p => p.platform),
      },
    },
    browserVsIDE: {
      browserAvg,
      ideAvg,
      ratio: browserAvg / ideAvg,
    },
  };
  
  return {
    platforms: platformMetrics.sort((a, b) => b.avgStars - a.avgStars),
    aggregate,
    insights,
  };
}

