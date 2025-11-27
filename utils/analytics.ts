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
  
  for (const platform of SUPPORTED_PLATFORMS) {
    try {
      const metadataPath = getDataPath(platform, 'metadata.json');
      const top100Path = getDataPath(platform, 'top100.json');
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const top100 = JSON.parse(fs.readFileSync(top100Path, 'utf8'));
      
      const stars = top100.top100.reduce((sum: number, p: any) => sum + (p.stars || 0), 0);
      const downloads = top100.top100.reduce((sum: number, p: any) => sum + (p.downloads || 0), 0);
      const issues = top100.top100.reduce((sum: number, p: any) => sum + ((p.githubStats?.openIssues || p.openIssues) || 0), 0);
      const forks = top100.top100.reduce((sum: number, p: any) => sum + ((p.githubStats?.forks || p.forks) || 0), 0);
      
      platformMetrics.push({
        platform,
        totalPlugins: metadata.totalCount,
        top100Count: top100.top100.length,
        totalStars: stars,
        avgStars: stars / 100,
        totalDownloads: downloads,
        avgDownloads: downloads / 100,
        totalIssues: issues,
        avgIssues: issues / 100,
        issueDensity: stars > 0 ? issues / stars : 0,
        totalForks: forks,
        avgForks: forks / 100,
        category: PLATFORM_CATEGORIES[platform],
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

