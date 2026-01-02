#!/usr/bin/env node

/**
 * GitHub Repository Analytics Generator
 * Analyzes all top100.json files and generates comprehensive analytics
 * Output: data/github-analytics.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const PLATFORM_ROOT = fs.existsSync(path.join(DATA_DIR, 'platforms'))
  ? path.join(DATA_DIR, 'platforms')
  : DATA_DIR;
const OUTPUT_FILE = path.join(DATA_DIR, 'github-analytics.json');

const PLATFORMS = [
  'chrome',
  'firefox',
  'homeassistant',
  'jetbrains',
  'minecraft',
  'obsidian',
  'sublime',
  'vscode',
  'wordpress',
];

console.log('=== GitHub Repository Analytics Generator ===\n');

// Initialize data structures
const repoMap = new Map();
const platformStats = {};
const allPlugins = [];
const languageStats = {};
const licenseStats = {};
const missingRepos = [];
let totalStars = 0;
let totalForks = 0;
let totalIssues = 0;

/**
 * Normalize repository URL to owner/repo format
 */
function normalizeRepo(repoUrl) {
  if (!repoUrl) return null;
  
  let repo = repoUrl.trim();
  repo = repo.replace(/^https?:\/\/github\.com\//i, '');
  repo = repo.replace(/^github\.com\//i, '');
  repo = repo.replace(/\.git$/i, '');
  
  const parts = repo.split('/');
  if (parts.length < 2) return null;
  
  const owner = parts[0].trim();
  const name = parts[1].trim();
  
  if (!owner || !name) return null;
  
  return `${owner}/${name}`;
}

/**
 * Process a single platform's top100.json file
 */
function processPlatform(platform) {
  const topFile = path.join(PLATFORM_ROOT, platform, 'top100.json');
  
  if (!fs.existsSync(topFile)) {
    console.log(`  ⚠ Skipping ${platform} - file not found`);
    return;
  }
  
  console.log(`  Processing ${platform}...`);
  
  const data = JSON.parse(fs.readFileSync(topFile, 'utf8'));
  const pluginCount = data.top100?.length || 0;
  
  platformStats[platform] = {
    totalPlugins: pluginCount,
    withGithubRepo: 0,
    withoutRepo: 0,
    uniqueRepos: 0,
    sharedRepos: 0,
    totalStars: 0,
    totalForks: 0,
    totalOpenIssues: 0,
    languages: {},
    licenses: {},
    plugins: [],
  };
  
  for (const plugin of data.top100 || []) {
    const pluginEntry = {
      id: plugin.id,
      name: plugin.name,
      platform,
      repo: plugin.repo,
      hasRepo: false,
      normalizedRepo: null,
    };
    
    if (plugin.repo) {
      platformStats[platform].withGithubRepo++;
      pluginEntry.hasRepo = true;
      
      const normalizedRepo = normalizeRepo(plugin.repo);
      
      if (normalizedRepo) {
        pluginEntry.normalizedRepo = normalizedRepo;
        
        // Track repo across platforms
        if (!repoMap.has(normalizedRepo)) {
          repoMap.set(normalizedRepo, {
            repo: normalizedRepo,
            platforms: [],
            pluginCount: 0,
            githubStats: null,
          });
        }
        
        const repoData = repoMap.get(normalizedRepo);
        repoData.platforms.push({
          platform,
          pluginName: plugin.name,
          pluginId: plugin.id,
        });
        repoData.pluginCount++;
        
        // Extract GitHub stats if available
        if (plugin.githubStats) {
          const stats = plugin.githubStats;
          
          // Store first occurrence of stats for this repo
          if (!repoData.githubStats) {
            repoData.githubStats = {
              stars: stats.stars || 0,
              forks: stats.forks || 0,
              openIssues: stats.openIssues || 0,
              watchers: stats.watchers || 0,
              language: stats.language || null,
              license: stats.license || null,
              topics: stats.topics || [],
              size: stats.size || 0,
              createdAt: stats.createdAt || null,
              lastUpdated: stats.lastUpdated || null,
              defaultBranch: stats.defaultBranch || 'main',
              archived: stats.archived || false,
              disabled: stats.disabled || false,
            };
            
            // Aggregate stats
            if (stats.stars) {
              platformStats[platform].totalStars += stats.stars;
              totalStars += stats.stars;
            }
            if (stats.forks) {
              platformStats[platform].totalForks += stats.forks;
              totalForks += stats.forks;
            }
            if (stats.openIssues) {
              platformStats[platform].totalOpenIssues += stats.openIssues;
              totalIssues += stats.openIssues;
            }
            
            // Language stats
            if (stats.language) {
              const lang = stats.language;
              platformStats[platform].languages[lang] = (platformStats[platform].languages[lang] || 0) + 1;
              languageStats[lang] = (languageStats[lang] || 0) + 1;
            }
            
            // License stats
            if (stats.license) {
              const lic = stats.license;
              platformStats[platform].licenses[lic] = (platformStats[platform].licenses[lic] || 0) + 1;
              licenseStats[lic] = (licenseStats[lic] || 0) + 1;
            }
          }
          
          pluginEntry.githubStats = {
            stars: stats.stars || 0,
            forks: stats.forks || 0,
            openIssues: stats.openIssues || 0,
            language: stats.language || null,
            license: stats.license || null,
          };
        }
      }
    } else {
      platformStats[platform].withoutRepo++;
      missingRepos.push({
        platform,
        id: plugin.id,
        name: plugin.name,
      });
    }
    
    platformStats[platform].plugins.push(pluginEntry);
    allPlugins.push(pluginEntry);
  }
  
  console.log(`    ✓ Found ${pluginCount} plugins, ${platformStats[platform].withGithubRepo} with GitHub repos`);
}

/**
 * Main execution
 */
function main() {
  console.log('Processing platforms...\n');
  
  // Process all platforms
  for (const platform of PLATFORMS) {
    processPlatform(platform);
  }
  
  console.log('\nAnalyzing repositories...\n');
  
  // Calculate stats
  const uniqueRepos = repoMap.size;
  const duplicateRepos = Array.from(repoMap.values()).filter(r => r.pluginCount > 1).length;
  const totalPluginsWithRepos = allPlugins.filter(p => p.hasRepo).length;
  
  // Count unique vs shared repos per platform
  for (const platform of Object.keys(platformStats)) {
    const platformRepos = new Set(
      platformStats[platform].plugins
        .filter(p => p.normalizedRepo)
        .map(p => p.normalizedRepo)
    );
    platformStats[platform].uniqueRepos = platformRepos.size;
    
    let sharedCount = 0;
    for (const repo of platformRepos) {
      if (repoMap.get(repo).pluginCount > 1) {
        sharedCount++;
      }
    }
    platformStats[platform].sharedRepos = sharedCount;
  }
  
  // Top repositories by stars
  const topReposByStars = Array.from(repoMap.entries())
    .filter(([_, data]) => data.githubStats && data.githubStats.stars)
    .sort((a, b) => b[1].githubStats.stars - a[1].githubStats.stars)
    .slice(0, 50)
    .map(([repo, data]) => ({
      repo,
      stars: data.githubStats.stars,
      forks: data.githubStats.forks,
      language: data.githubStats.language,
      license: data.githubStats.license,
      pluginCount: data.pluginCount,
      platforms: [...new Set(data.platforms.map(p => p.platform))],
    }));
  
  // Most duplicated repos
  const mostDuplicatedRepos = Array.from(repoMap.entries())
    .filter(([_, data]) => data.pluginCount > 1)
    .sort((a, b) => b[1].pluginCount - a[1].pluginCount)
    .slice(0, 30)
    .map(([repo, data]) => ({
      repo,
      pluginCount: data.pluginCount,
      platforms: data.platforms,
      githubStats: data.githubStats,
    }));
  
  // Language stats sorted
  const topLanguages = Object.entries(languageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / uniqueRepos) * 10000) / 100,
    }));
  
  // License stats sorted
  const topLicenses = Object.entries(licenseStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([license, count]) => ({
      license,
      count,
      percentage: Math.round((count / uniqueRepos) * 10000) / 100,
    }));
  
  // Calculate averages
  const avgStars = uniqueRepos > 0 ? Math.round(totalStars / uniqueRepos * 10) / 10 : 0;
  const avgForks = uniqueRepos > 0 ? Math.round(totalForks / uniqueRepos * 10) / 10 : 0;
  const avgIssues = uniqueRepos > 0 ? Math.round(totalIssues / uniqueRepos * 10) / 10 : 0;

  const repoCoverage = {
    totalPlugins: allPlugins.length,
    withRepos: totalPluginsWithRepos,
    withoutRepos: allPlugins.length - totalPluginsWithRepos,
    byPlatform: {},
    missing: missingRepos,
  };
  
  // Build final analytics object
  const analytics = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlugins: allPlugins.length,
      totalPlatforms: PLATFORMS.length,
      pluginsWithRepos: totalPluginsWithRepos,
      pluginsWithoutRepos: allPlugins.length - totalPluginsWithRepos,
      uniqueRepositories: uniqueRepos,
      duplicateRepositories: duplicateRepos,
      deduplicationSavings: allPlugins.length - uniqueRepos,
      totalStars,
      totalForks,
      totalOpenIssues: totalIssues,
      averageStars: avgStars,
      averageForks: avgForks,
      averageOpenIssues: avgIssues,
    },
    repoCoverage,
    platforms: {},
    topRepositories: {
      byStars: topReposByStars,
      mostDuplicated: mostDuplicatedRepos,
    },
    languages: {
      summary: topLanguages,
      total: Object.keys(languageStats).length,
    },
    licenses: {
      summary: topLicenses,
      total: Object.keys(licenseStats).length,
    },
    repositories: {},
  };
  
  // Add platform details
  for (const platform of Object.keys(platformStats)) {
    const stats = platformStats[platform];
    repoCoverage.byPlatform[platform] = {
      totalPlugins: stats.totalPlugins,
      withRepos: stats.withGithubRepo,
      withoutRepos: stats.withoutRepo,
    };
    
    const topPlatformLanguages = Object.entries(stats.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([language, count]) => ({ language, count }));
    
    const topPlatformLicenses = Object.entries(stats.licenses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([license, count]) => ({ license, count }));
    
    analytics.platforms[platform] = {
      totalPlugins: stats.totalPlugins,
      withGithubRepo: stats.withGithubRepo,
      withoutRepo: stats.withoutRepo,
      uniqueRepos: stats.uniqueRepos,
      sharedRepos: stats.sharedRepos,
      totalStars: stats.totalStars,
      totalForks: stats.totalForks,
      totalOpenIssues: stats.totalOpenIssues,
      averageStars: stats.uniqueRepos > 0 ? Math.round(stats.totalStars / stats.uniqueRepos * 10) / 10 : 0,
      topLanguages: topPlatformLanguages,
      topLicenses: topPlatformLicenses,
    };
  }
  
  // Add all repositories with details
  for (const [repo, repoData] of repoMap.entries()) {
    analytics.repositories[repo] = {
      pluginCount: repoData.pluginCount,
      platforms: repoData.platforms,
      githubStats: repoData.githubStats,
      isDuplicate: repoData.pluginCount > 1,
    };
  }
  
  console.log('Generating JSON output...\n');
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analytics, null, 2), 'utf8');
  
  // Print summary
  console.log('======================================');
  console.log('Analytics generated successfully!');
  console.log('======================================\n');
  
  console.log('Summary:');
  console.log(`  Total plugins: ${analytics.summary.totalPlugins}`);
  console.log(`  Unique repositories: ${analytics.summary.uniqueRepositories}`);
  console.log(`  Duplicate repos: ${analytics.summary.duplicateRepositories}`);
  console.log(`  Deduplication savings: ${analytics.summary.deduplicationSavings} plugins\n`);

  console.log(`  Repo coverage: ${analytics.repoCoverage.withRepos}/${analytics.repoCoverage.totalPlugins} with repos (${analytics.repoCoverage.withoutRepos} missing)\n`);
  
  console.log(`  Total stars: ${analytics.summary.totalStars.toLocaleString()}`);
  console.log(`  Total forks: ${analytics.summary.totalForks.toLocaleString()}`);
  console.log(`  Average stars per repo: ${analytics.summary.averageStars}\n`);
  
  if (topLanguages.length > 0) {
    console.log(`  Top language: ${topLanguages[0].language} (${topLanguages[0].count} repos)`);
  }
  if (topLicenses.length > 0) {
    console.log(`  Top license: ${topLicenses[0].license} (${topLicenses[0].count} repos)`);
  }
  
  console.log(`\nOutput saved to: ${OUTPUT_FILE}\n`);
  
  console.log('Platform breakdown:');
  for (const platform of PLATFORMS) {
    if (analytics.platforms[platform]) {
      const pStats = analytics.platforms[platform];
      console.log(`  ${platform}: ${pStats.totalPlugins} plugins, ${pStats.uniqueRepos} unique repos, ${pStats.totalStars.toLocaleString()} stars`);
    }
  }
  
  console.log('\n');
}

// Run
try {
  main();
} catch (error) {
  console.error('Error generating analytics:', error);
  process.exit(1);
}











