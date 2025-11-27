/**
 * Generate analytics summary JSON file
 * This creates a standalone analytics summary that can be used by external tools
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED_PLATFORMS = [
  'obsidian', 'vscode', 'firefox', 'homeassistant', 'wordpress',
  'jetbrains', 'sublime', 'minecraft', 'chrome'
];

const PLATFORM_CATEGORIES = {
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

function getDataPath(platform, filename) {
  return path.join(__dirname, '..', 'data', platform, filename);
}

async function generateAnalyticsSummary() {
  console.log('📊 Generating analytics summary...\n');
  
  const platformMetrics = [];
  
  for (const platform of SUPPORTED_PLATFORMS) {
    try {
      const metadataPath = getDataPath(platform, 'metadata.json');
      const top100Path = getDataPath(platform, 'top100.json');
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const top100 = JSON.parse(fs.readFileSync(top100Path, 'utf8'));
      
      const stars = top100.top100.reduce((sum, p) => sum + (p.stars || 0), 0);
      const downloads = top100.top100.reduce((sum, p) => sum + (p.downloads || 0), 0);
      const issues = top100.top100.reduce((sum, p) => sum + ((p.githubStats?.openIssues || p.openIssues) || 0), 0);
      const forks = top100.top100.reduce((sum, p) => sum + ((p.githubStats?.forks || p.forks) || 0), 0);
      
      platformMetrics.push({
        platform,
        totalPlugins: metadata.totalCount,
        top100Count: top100.top100.length,
        totalStars: stars,
        avgStars: Math.round(stars / 100),
        totalDownloads: downloads,
        avgDownloads: Math.round(downloads / 100),
        totalIssues: issues,
        avgIssues: Math.round(issues / 100),
        issueDensity: stars > 0 ? (issues / stars) : 0,
        totalForks: forks,
        avgForks: Math.round(forks / 100),
        category: PLATFORM_CATEGORIES[platform],
      });
      
      console.log(`✓ ${platform.padEnd(15)} - ${metadata.totalCount.toLocaleString().padStart(6)} plugins, ${Math.round(stars/100).toLocaleString().padStart(5)} avg stars`);
    } catch (error) {
      console.error(`✗ ${platform}: ${error.message}`);
    }
  }
  
  // Calculate aggregate metrics
  const totalPlugins = platformMetrics.reduce((sum, p) => sum + p.totalPlugins, 0);
  const totalStars = platformMetrics.reduce((sum, p) => sum + p.totalStars, 0);
  const totalDownloads = platformMetrics.reduce((sum, p) => sum + p.totalDownloads, 0);
  const totalIssues = platformMetrics.reduce((sum, p) => sum + p.totalIssues, 0);
  const totalForks = platformMetrics.reduce((sum, p) => sum + p.totalForks, 0);
  const totalTop100 = platformMetrics.reduce((sum, p) => sum + p.top100Count, 0);
  
  const aggregate = {
    totalPlugins,
    totalTop100,
    totalStars,
    totalDownloads,
    totalIssues,
    totalForks,
    avgStarsPerPlugin: Math.round(totalStars / totalTop100),
    avgDownloadsPerPlugin: Math.round(totalDownloads / totalTop100),
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
      ratio: parseFloat((sortedByStars[0].avgStars / sortedByStars[sortedByStars.length - 1].avgStars).toFixed(1)),
    },
    downloadConcentration: {
      top1: {
        platform: sortedByDownloads[0].platform,
        downloads: sortedByDownloads[0].totalDownloads,
        percentage: parseFloat(((sortedByDownloads[0].totalDownloads / totalDownloads) * 100).toFixed(1)),
      },
      top2: {
        platform: sortedByDownloads[1].platform,
        downloads: sortedByDownloads[1].totalDownloads,
        percentage: parseFloat(((sortedByDownloads[1].totalDownloads / totalDownloads) * 100).toFixed(1)),
      },
      top2Combined: parseFloat(((top2Downloads / totalDownloads) * 100).toFixed(1)),
    },
    scaleCategories: {
      massive: {
        count: massive.length,
        avgStars: Math.round(massive.reduce((s, p) => s + p.avgStars, 0) / massive.length),
        platforms: massive.map(p => p.platform),
      },
      large: {
        count: large.length,
        avgStars: Math.round(large.reduce((s, p) => s + p.avgStars, 0) / large.length),
        platforms: large.map(p => p.platform),
      },
      medium: {
        count: medium.length,
        avgStars: Math.round(medium.reduce((s, p) => s + p.avgStars, 0) / medium.length),
        platforms: medium.map(p => p.platform),
      },
      boutique: {
        count: boutique.length,
        avgStars: Math.round(boutique.reduce((s, p) => s + p.avgStars, 0) / boutique.length),
        platforms: boutique.map(p => p.platform),
      },
    },
    browserVsIDE: {
      browserAvg: Math.round(browserAvg),
      ideAvg: Math.round(ideAvg),
      ratio: parseFloat((browserAvg / ideAvg).toFixed(1)),
    },
  };
  
  const summary = {
    generatedAt: new Date().toISOString(),
    platforms: platformMetrics.sort((a, b) => b.avgStars - a.avgStars),
    aggregate,
    insights,
  };
  
  // Write summary file
  const outputPath = path.join(__dirname, '..', 'data', 'analytics-summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 AGGREGATE STATISTICS');
  console.log('='.repeat(70));
  console.log(`Total plugins:          ${aggregate.totalPlugins.toLocaleString()}`);
  console.log(`Total top 100:          ${aggregate.totalTop100}`);
  console.log(`Total GitHub stars:     ${aggregate.totalStars.toLocaleString()}`);
  console.log(`Total downloads:        ${aggregate.totalDownloads.toLocaleString()}`);
  console.log(`Avg stars per plugin:   ${aggregate.avgStarsPerPlugin.toLocaleString()}`);
  
  console.log('\n💡 KEY INSIGHTS');
  console.log('='.repeat(70));
  console.log(`Star Paradox:           ${insights.starConcentrationParadox.highest.platform} (${insights.starConcentrationParadox.highest.stars}) vs ${insights.starConcentrationParadox.lowest.platform} (${insights.starConcentrationParadox.lowest.stars}) = ${insights.starConcentrationParadox.ratio}x`);
  console.log(`Download Concentration: Top 2 platforms control ${insights.downloadConcentration.top2Combined}% of downloads`);
  console.log(`Browser vs IDE:         ${insights.browserVsIDE.ratio}x higher engagement for browsers`);
  
  console.log('\n✅ Analytics summary saved to: data/analytics-summary.json\n');
}

generateAnalyticsSummary().catch(console.error);

