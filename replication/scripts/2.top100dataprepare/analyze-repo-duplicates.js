#!/usr/bin/env node

/**
 * Repository Duplication & Monorepo Analysis
 * Analyzes which repos host multiple plugins and identifies monorepo patterns
 * Output: data/repo-duplication-analysis.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'repo-duplication-analysis.json');

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

// Platform official owners/organizations
const PLATFORM_OWNERS = {
  chrome: ['google', 'googlechrome', 'chromium'],
  firefox: ['mozilla', 'firefox'],
  homeassistant: ['home-assistant', 'homeassistant'],
  jetbrains: ['jetbrains'],
  minecraft: ['mojang', 'minecraft'],
  obsidian: ['obsidianmd'],
  sublime: ['sublimehq', 'sublimetext'],
  vscode: ['microsoft'],
  wordpress: ['wordpress', 'automattic'],
};

// Well-known corporate/institutional GitHub organizations
const CORPORATE_ORGS = [
  // Big Tech
  'facebook', 'meta', 'facebookincubator', 'facebookexperimental',
  'netflix', 'netflixoss',
  'amazon', 'aws', 'awslabs', 'aws-samples',
  'uber', 'uber-common', 'uber-go',
  'apple', 'airbnb', 'linkedin', 'twitter', 'x',
  'stripe', 'shopify', 'square', 'paypal',
  'alibaba', 'tencent', 'baidu',
  'oracle', 'ibm', 'sap', 'salesforce',
  'yahoo', 'ebay', 'spotify', 'lyft', 'slack',
  'atlassian', 'gitlab', 'github',
  'redhat', 'canonical', 'digitalocean', 'hashicorp',
  'cloudflare', 'vercel', 'netlify',
  
  // Tech Companies
  'intel', 'nvidia', 'amd', 'vmware', 'docker',
  'elastic', 'mongodb', 'redis', 'postgresql', 'mysql',
  'databricks', 'snowflake', 'confluent',
  
  // Development Tools & Frameworks
  'facebook/react', 'reactjs', 'vuejs', 'angular',
  'nodejs', 'denoland', 'bun-sh',
  'electron', 'tauri-apps',
  'webpack', 'vitejs', 'rollup',
  
  // Security & Open Source Foundations
  'owasp', 'torproject', 'eff', 'efforg',
  'openjsf', 'cncf', 'linuxfoundation',
  'apache', 'eclipse', 'mozilla-mobile',
  
  // Media & Content
  'bbc', 'guardian', 'nytimes', 'vimeo',
  
  // Gaming
  'unity', 'unity-technologies', 'unrealengine', 'epicgames',
  'riotgames', 'blizzard', 'valve',
  
  // Other Notable Orgs
  'wordpress', 'woocommerce', 'yoast',
  'jetpack', 'godaddy', 'hostgator',
  'jetbrains', 'sublimehq',
];

console.log('=== Repository Duplication & Monorepo Analysis ===\n');

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
 * Determine if plugin is official (platform-owned), corporate, or community
 */
function determineOwnership(repo, platform) {
  const owner = repo.split('/')[0].toLowerCase();
  const platformOwners = PLATFORM_OWNERS[platform] || [];
  
  // Check if official platform owner
  const isOfficial = platformOwners.some(officialOwner => 
    owner === officialOwner.toLowerCase()
  );
  
  if (isOfficial) {
    return {
      type: 'official',
      owner: repo.split('/')[0],
      isVerified: true,
      isCorporate: false,
    };
  }
  
  // Check if corporate/institutional
  const isCorporate = CORPORATE_ORGS.some(corp => 
    owner === corp.toLowerCase()
  );
  
  if (isCorporate) {
    return {
      type: 'corporate',
      owner: repo.split('/')[0],
      isVerified: false,
      isCorporate: true,
    };
  }
  
  // Otherwise, it's an individual/small team community contribution
  return {
    type: 'community',
    owner: repo.split('/')[0],
    isVerified: false,
    isCorporate: false,
  };
}

/**
 * Detect if a repo is likely a monorepo based on patterns
 */
function detectMonorepoPattern(repo, pluginNames) {
  const repoLower = repo.toLowerCase();
  const repoName = repo.split('/')[1].toLowerCase();
  
  // Common monorepo indicators
  const monorepoIndicators = [
    'community',
    'plugins',
    'extensions',
    'packages',
    'monorepo',
    'workspace',
    'all-in-one',
    'suite',
    'toolkit',
    'platform',
    'core',
    'framework',
  ];
  
  // Check if repo name indicates monorepo
  const hasMonorepoName = monorepoIndicators.some(indicator => 
    repoName.includes(indicator)
  );
  
  // Check if plugins have very different names (likely separate projects in monorepo)
  const pluginNamesLower = pluginNames.map(n => n.toLowerCase());
  const allPluginsSimilar = pluginNames.length <= 1 || pluginNamesLower.every(name => {
    const firstWords = pluginNamesLower[0].split(' ').slice(0, 2).join(' ');
    return name.includes(firstWords) || firstWords.includes(name.split(' ')[0]);
  });
  
  return {
    isLikelyMonorepo: hasMonorepoName || (pluginNames.length > 3 && !allPluginsSimilar),
    hasMonorepoName,
    pluginNamesVarySignificantly: !allPluginsSimilar,
  };
}

/**
 * Categorize repository type
 */
function categorizeRepo(repoData) {
  const pluginCount = repoData.plugins.length;
  const platformCount = new Set(repoData.plugins.map(p => p.platform)).size;
  const pluginNames = repoData.plugins.map(p => p.pluginName);
  
  // Single plugin, single platform = Dedicated
  if (pluginCount === 1 && platformCount === 1) {
    return {
      type: 'dedicated',
      description: 'Dedicated repository for a single plugin',
    };
  }
  
  // Multiple plugins, same platform
  if (pluginCount > 1 && platformCount === 1) {
    const monorepoAnalysis = detectMonorepoPattern(repoData.repo, pluginNames);
    
    if (monorepoAnalysis.isLikelyMonorepo) {
      return {
        type: 'monorepo-same-platform',
        description: `Monorepo hosting ${pluginCount} plugins for the same platform`,
        monorepoAnalysis,
      };
    }
    
    return {
      type: 'multi-plugin-same-platform',
      description: `Repository with ${pluginCount} related plugins for the same platform`,
    };
  }
  
  // Multiple plugins, different platforms = Cross-platform
  if (pluginCount > 1 && platformCount > 1) {
    const monorepoAnalysis = detectMonorepoPattern(repoData.repo, pluginNames);
    
    return {
      type: 'cross-platform',
      description: `Cross-platform repository with plugins for ${platformCount} different platforms`,
      monorepoAnalysis,
    };
  }
  
  return {
    type: 'other',
    description: 'Unknown pattern',
  };
}

/**
 * Main analysis
 */
function analyzeRepositories() {
  console.log('Collecting repository data...\n');
  
  const repoMap = new Map();
  
  // Collect all plugins and their repos
  for (const platform of PLATFORMS) {
    const topFile = path.join(DATA_DIR, platform, 'top100.json');
    
    if (!fs.existsSync(topFile)) {
      console.log(`  ⚠ Skipping ${platform} - file not found`);
      continue;
    }
    
    console.log(`  Processing ${platform}...`);
    
    const data = JSON.parse(fs.readFileSync(topFile, 'utf8'));
    
    for (const plugin of data.top100 || []) {
      if (!plugin.repo) continue;
      
      const normalizedRepo = normalizeRepo(plugin.repo);
      if (!normalizedRepo) continue;
      
      if (!repoMap.has(normalizedRepo)) {
        repoMap.set(normalizedRepo, {
          repo: normalizedRepo,
          plugins: [],
          githubStats: plugin.githubStats || null,
          repoUrl: plugin.repo,
        });
      }
      
      repoMap.get(normalizedRepo).plugins.push({
        platform,
        pluginId: plugin.id,
        pluginName: plugin.name,
        author: plugin.author,
        description: plugin.description,
      });
    }
  }
  
  console.log(`\n✓ Found ${repoMap.size} unique repositories\n`);
  console.log('Analyzing repository patterns...\n');
  
  // Analyze each repository
  const analysis = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlugins: 0,
      totalRepositories: repoMap.size,
      dedicated: 0,
      multiPluginSamePlatform: 0,
      monorepoSamePlatform: 0,
      crossPlatform: 0,
      other: 0,
      duplicateRepositories: 0,
      pluginsInSharedRepos: 0,
      officialPlugins: 0,
      corporatePlugins: 0,
      communityPlugins: 0,
    },
    ownership: {
      byPlatform: {},
      officialRepos: [],
      corporateRepos: [],
      communityRepos: [],
    },
    categories: {
      dedicated: [],
      multiPluginSamePlatform: [],
      monorepoSamePlatform: [],
      crossPlatform: [],
    },
    duplicateDetails: [],
    allPlugins: [],
    detailedAnalysis: {},
  };
  
  // Initialize platform ownership counters
  for (const platform of PLATFORMS) {
    analysis.ownership.byPlatform[platform] = {
      official: 0,
      corporate: 0,
      community: 0,
      total: 0,
    };
  }
  
  // Process each repo
  for (const [repo, repoData] of repoMap.entries()) {
    const category = categorizeRepo(repoData);
    const pluginCount = repoData.plugins.length;
    const platforms = [...new Set(repoData.plugins.map(p => p.platform))];
    
    const repoAnalysis = {
      repo,
      repoUrl: repoData.repoUrl,
      category: category.type,
      categoryDescription: category.description,
      pluginCount,
      platformCount: platforms.length,
      platforms,
      plugins: repoData.plugins,
      githubStats: repoData.githubStats ? {
        stars: repoData.githubStats.stars || 0,
        forks: repoData.githubStats.forks || 0,
        language: repoData.githubStats.language || null,
        topics: repoData.githubStats.topics || [],
        size: repoData.githubStats.size || 0,
      } : null,
      monorepoAnalysis: category.monorepoAnalysis || null,
    };
    
    // Add to detailed analysis
    analysis.detailedAnalysis[repo] = repoAnalysis;
    
    // Add all plugins with repo info and ownership
    for (const plugin of repoData.plugins) {
      const ownership = determineOwnership(repo, plugin.platform);
      
      analysis.allPlugins.push({
        ...plugin,
        repo,
        repoUrl: repoData.repoUrl,
        category: category.type,
        sharesRepoWith: pluginCount > 1 ? pluginCount - 1 : 0,
        totalPluginsInRepo: pluginCount,
        ownership: ownership.type,
        repoOwner: ownership.owner,
        isVerified: ownership.isVerified,
        isCorporate: ownership.isCorporate,
      });
      
      // Update ownership counters
      if (ownership.type === 'official') {
        analysis.summary.officialPlugins++;
        analysis.ownership.byPlatform[plugin.platform].official++;
      } else if (ownership.type === 'corporate') {
        analysis.summary.corporatePlugins++;
        analysis.ownership.byPlatform[plugin.platform].corporate++;
      } else {
        analysis.summary.communityPlugins++;
        analysis.ownership.byPlatform[plugin.platform].community++;
      }
      analysis.ownership.byPlatform[plugin.platform].total++;
    }
    
    // Track duplicates
    if (pluginCount > 1) {
      analysis.summary.duplicateRepositories++;
      analysis.summary.pluginsInSharedRepos += pluginCount;
      
      analysis.duplicateDetails.push({
        repo,
        repoUrl: repoData.repoUrl,
        pluginCount,
        category: category.type,
        platforms,
        plugins: repoData.plugins,
        githubStats: repoData.githubStats ? {
          stars: repoData.githubStats.stars || 0,
          language: repoData.githubStats.language || null,
        } : null,
      });
    }
    
    // Update summary and categorize
    switch (category.type) {
      case 'dedicated':
        analysis.summary.dedicated++;
        break;
      case 'multi-plugin-same-platform':
        analysis.summary.multiPluginSamePlatform++;
        analysis.categories.multiPluginSamePlatform.push(repoAnalysis);
        break;
      case 'monorepo-same-platform':
        analysis.summary.monorepoSamePlatform++;
        analysis.categories.monorepoSamePlatform.push(repoAnalysis);
        break;
      case 'cross-platform':
        analysis.summary.crossPlatform++;
        analysis.categories.crossPlatform.push(repoAnalysis);
        break;
      default:
        analysis.summary.other++;
    }
  }
  
  // Sort categories and duplicate details
  for (const category of Object.keys(analysis.categories)) {
    analysis.categories[category].sort((a, b) => b.pluginCount - a.pluginCount);
  }
  analysis.duplicateDetails.sort((a, b) => b.pluginCount - a.pluginCount);
  
  // Categorize repos by ownership
  for (const [repo, repoAnalysis] of Object.entries(analysis.detailedAnalysis)) {
    // Determine ownership type (use first plugin's platform for detection)
    const ownership = determineOwnership(repo, repoAnalysis.plugins[0].platform);
    
    const repoInfo = {
      repo,
      pluginCount: repoAnalysis.pluginCount,
      platforms: repoAnalysis.platforms,
      plugins: repoAnalysis.plugins.map(p => p.pluginName),
      owner: ownership.owner,
    };
    
    if (ownership.type === 'official') {
      analysis.ownership.officialRepos.push(repoInfo);
    } else if (ownership.type === 'corporate') {
      analysis.ownership.corporateRepos.push(repoInfo);
    } else {
      analysis.ownership.communityRepos.push(repoInfo);
    }
  }
  
  // Sort by plugin count
  analysis.ownership.officialRepos.sort((a, b) => b.pluginCount - a.pluginCount);
  analysis.ownership.corporateRepos.sort((a, b) => b.pluginCount - a.pluginCount);
  analysis.ownership.communityRepos.sort((a, b) => b.pluginCount - a.pluginCount);
  
  // Update total plugins count
  analysis.summary.totalPlugins = analysis.allPlugins.length;
  
  return analysis;
}

/**
 * Main execution
 */
function main() {
  const analysis = analyzeRepositories();
  
  console.log('Generating output...\n');
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysis, null, 2), 'utf8');
  
  console.log('======================================');
  console.log('Analysis Complete!');
  console.log('======================================\n');
  
  console.log('Overall Statistics:');
  console.log(`  Total plugins: ${analysis.summary.totalPlugins}`);
  console.log(`  Total repositories: ${analysis.summary.totalRepositories}`);
  console.log(`  Duplicate repositories: ${analysis.summary.duplicateRepositories}`);
  console.log(`  Plugins in shared repos: ${analysis.summary.pluginsInSharedRepos}`);
  console.log('');
  
  console.log('Ownership Breakdown:');
  console.log(`  Official (platform-owned): ${analysis.summary.officialPlugins}`);
  console.log(`  Corporate (big companies): ${analysis.summary.corporatePlugins}`);
  console.log(`  Community (individuals): ${analysis.summary.communityPlugins}`);
  console.log(`  Official repos: ${analysis.ownership.officialRepos.length}`);
  console.log(`  Corporate repos: ${analysis.ownership.corporateRepos.length}`);
  console.log(`  Community repos: ${analysis.ownership.communityRepos.length}`);
  console.log('');
  
  console.log('Repository Breakdown:');
  console.log(`  Dedicated (1 plugin): ${analysis.summary.dedicated}`);
  console.log(`  Multi-plugin same platform: ${analysis.summary.multiPluginSamePlatform}`);
  console.log(`  Monorepo same platform: ${analysis.summary.monorepoSamePlatform}`);
  console.log(`  Cross-platform: ${analysis.summary.crossPlatform}`);
  if (analysis.summary.other > 0) {
    console.log(`  Other: ${analysis.summary.other}`);
  }
  
  console.log('\n');
  
  // Show ownership by platform
  console.log('Ownership by Platform:');
  for (const platform of PLATFORMS) {
    const stats = analysis.ownership.byPlatform[platform];
    if (stats.total > 0) {
      const officialPercent = ((stats.official / stats.total) * 100).toFixed(1);
      const corporatePercent = ((stats.corporate / stats.total) * 100).toFixed(1);
      console.log(`  ${platform}: ${stats.official} official / ${stats.corporate} corporate / ${stats.community} community (${officialPercent}% official, ${corporatePercent}% corporate)`);
    }
  }
  
  console.log('\n');
  
  // Show top official repos
  if (analysis.ownership.officialRepos.length > 0) {
    console.log(`Official Platform Repos (${analysis.ownership.officialRepos.length} total):`);
    analysis.ownership.officialRepos.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.repo} - ${r.pluginCount} plugin${r.pluginCount > 1 ? 's' : ''} [${r.platforms.join(', ')}]`);
    });
    console.log('');
  }
  
  // Show top corporate repos
  if (analysis.ownership.corporateRepos.length > 0) {
    console.log(`Corporate/Institutional Repos (${analysis.ownership.corporateRepos.length} total):`);
    analysis.ownership.corporateRepos.slice(0, 15).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.repo} - ${r.pluginCount} plugin${r.pluginCount > 1 ? 's' : ''} [${r.platforms.join(', ')}]`);
    });
    console.log('');
  }
  
  console.log('\n');
  
  // Show all duplicate repos
  if (analysis.duplicateDetails.length > 0) {
    console.log(`All Duplicate Repositories (${analysis.duplicateDetails.length} repos with ${analysis.summary.pluginsInSharedRepos} total plugins):\n`);
    
    analysis.duplicateDetails.forEach((dup, index) => {
      if (index < 20) { // Show top 20
        console.log(`  ${index + 1}. ${dup.repo} - ${dup.pluginCount} plugins [${dup.category}]`);
        console.log(`     Platforms: ${dup.platforms.join(', ')}`);
        dup.plugins.forEach(p => {
          console.log(`     • [${p.platform}] ${p.pluginName}`);
        });
        console.log('');
      }
    });
    
    if (analysis.duplicateDetails.length > 20) {
      console.log(`  ... and ${analysis.duplicateDetails.length - 20} more duplicate repos\n`);
    }
  }
  
  console.log(`\nOutput saved to: ${OUTPUT_FILE}\n`);
}

// Run
try {
  main();
} catch (error) {
  console.error('Error analyzing repositories:', error);
  process.exit(1);
}










