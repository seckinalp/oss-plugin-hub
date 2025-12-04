import fs from 'fs';
import path from 'path';
import { type SupportedPlatform } from '@/config/platforms';

export interface Top100Plugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  downloads: number;
  stars: number;
  lastUpdated: string;
  forks?: number;
  openIssues?: number;
  watchers?: number;
  language?: string;
  topics?: string[];
  license?: string;
  isTop100: boolean;
}

export interface PlatformAnalytics {
  platform: SupportedPlatform;
  pluginCount: number;
  
  // Distribution metrics
  totalStars: number;
  avgStars: number;
  medianStars: number;
  maxStars: { name: string; stars: number; repo: string };
  minStars: { name: string; stars: number; repo: string };
  
  totalDownloads: number;
  avgDownloads: number;
  medianDownloads: number;
  maxDownloads: { name: string; downloads: number; repo: string };
  
  totalForks: number;
  avgForks: number;
  
  totalIssues: number;
  avgIssues: number;
  issueDensity: number;
  
  // Language distribution
  topLanguages: Array<{ language: string; count: number; percentage: number }>;
  
  // License distribution
  topLicenses: Array<{ license: string; count: number; percentage: number }>;
  
  // Activity metrics
  recentlyUpdated: Array<{ name: string; lastUpdated: string; repo: string }>;
  mostActive: Array<{ name: string; stars: number; forks: number; repo: string }>;
  topIssueDensity: Array<{ name: string; repo: string; openIssues: number; stars: number; density: number }>;
  topForked: Array<{ name: string; repo: string; forks: number; stars: number }>;
  
  // Engagement metrics
  highEngagement: Array<{ name: string; stars: number; downloads: number; repo: string }>;
  
  // Topics
  topTopics: Array<{ topic: string; count: number }>;
  
  plugins: Top100Plugin[];
}

function getDataPath(platform: string, filename: string): string {
  return path.join(process.cwd(), 'data', platform, filename);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function getPlatformAnalytics(platform: SupportedPlatform): Promise<PlatformAnalytics | null> {
  try {
    const top100Path = getDataPath(platform, 'top100.json');

    let plugins: Top100Plugin[] = [];

    // Use top100.json as the single source
    if (fs.existsSync(top100Path)) {
      const top100Data = JSON.parse(fs.readFileSync(top100Path, 'utf8'));
      plugins = top100Data.top100 || [];
    }
    
    if (!plugins || plugins.length === 0) {
      return null;
    }
    
    // Helper accessors to prioritize githubStats when present
    const getStars = (p: any) => p.githubStats?.stars ?? p.stars ?? 0;
    const getForks = (p: any) => p.githubStats?.forks ?? p.forks ?? 0;
    const getIssues = (p: any) => p.githubStats?.openIssues ?? p.openIssues ?? 0;
    const getDownloads = (p: any) => p.downloads ?? 0;

    // Calculate basic stats
    const stars = plugins.map(getStars);
    const downloads = plugins.map(getDownloads);
    const forks = plugins.map(getForks);
    const issues = plugins.map(getIssues);
    
    const totalStars = stars.reduce((sum, s) => sum + s, 0);
    const totalDownloads = downloads.reduce((sum, d) => sum + d, 0);
    const totalForks = forks.reduce((sum, f) => sum + f, 0);
    const totalIssues = issues.reduce((sum, i) => sum + i, 0);
    
    // Find max/min
    const sortedByStars = [...plugins].sort((a, b) => getStars(b) - getStars(a));
    const sortedByDownloads = [...plugins].sort((a, b) => getDownloads(b) - getDownloads(a));
    
    // Language distribution
    const languageCount: Record<string, number> = {};
    plugins.forEach(p => {
      const lang = (p as any).githubStats?.language || (p as any).language || 'Unknown';
      languageCount[lang] = (languageCount[lang] || 0) + 1;
    });
    const topLanguages = Object.entries(languageCount)
      .map(([language, count]) => ({
        language,
        count,
        percentage: (count / plugins.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // License distribution
    const licenseCount: Record<string, number> = {};
    plugins.forEach(p => {
      const license = (p as any).githubStats?.license || (p as any).license || 'No License';
      licenseCount[license] = (licenseCount[license] || 0) + 1;
    });
    const topLicenses = Object.entries(licenseCount)
      .map(([license, count]) => ({
        license,
        count,
        percentage: (count / plugins.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Topics
    const topicCount: Record<string, number> = {};
    plugins.forEach(p => {
      const topics = (p as any).githubStats?.topics || (p as any).topics || [];
      topics.forEach((topic: string) => {
        topicCount[topic] = (topicCount[topic] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCount)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Recently updated
    const recentlyUpdated = [...plugins]
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        lastUpdated: p.lastUpdated,
        repo: p.repo
      }));
    
    // Most active (stars + forks)
    const mostActive = [...plugins]
      .sort((a, b) => (getStars(b) + getForks(b)) - (getStars(a) + getForks(a)))
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        stars: getStars(p),
        forks: getForks(p),
        repo: p.repo
      }));
    
    // High engagement (high stars relative to downloads)
    const highEngagement = [...plugins]
      .filter(p => getDownloads(p) > 0)
      .map(p => ({
        name: p.name,
        stars: getStars(p),
        downloads: getDownloads(p),
        repo: p.repo,
        ratio: getStars(p) / Math.log10(getDownloads(p) || 1)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10);

    // Issue density (open issues per star)
    const topIssueDensity = [...plugins]
      .filter(p => getStars(p) > 0)
      .map(p => ({
        name: p.name,
        repo: p.repo,
        openIssues: getIssues(p),
        stars: getStars(p),
        density: getIssues(p) / (getStars(p) || 1),
      }))
      .sort((a, b) => b.density - a.density)
      .slice(0, 10);

    // Fork leaders
    const topForked = [...plugins]
      .sort((a, b) => getForks(b) - getForks(a))
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        repo: p.repo,
        forks: getForks(p),
        stars: getStars(p),
      }));
    
    return {
      platform,
      pluginCount: plugins.length,
      
      totalStars,
      avgStars: totalStars / plugins.length,
      medianStars: calculateMedian(stars),
      maxStars: {
        name: sortedByStars[0].name,
        stars: getStars(sortedByStars[0]),
        repo: sortedByStars[0].repo
      },
      minStars: {
        name: sortedByStars[sortedByStars.length - 1].name,
        stars: getStars(sortedByStars[sortedByStars.length - 1]),
        repo: sortedByStars[sortedByStars.length - 1].repo
      },
      
      totalDownloads,
      avgDownloads: totalDownloads / plugins.length,
      medianDownloads: calculateMedian(downloads),
      maxDownloads: {
        name: sortedByDownloads[0].name,
        downloads: getDownloads(sortedByDownloads[0]),
        repo: sortedByDownloads[0].repo
      },
      
      totalForks,
      avgForks: totalForks / plugins.length,
      
      totalIssues,
      avgIssues: totalIssues / plugins.length,
      issueDensity: totalStars > 0 ? totalIssues / totalStars : 0,
      
      topLanguages,
      topLicenses,
      recentlyUpdated,
      mostActive,
      highEngagement,
      topIssueDensity,
      topForked,
      topTopics,
      
      plugins
    };
  } catch (error) {
    console.error(`Error loading analytics for ${platform}:`, error);
    return null;
  }
}

