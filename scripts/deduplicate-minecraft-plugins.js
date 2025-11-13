const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MINECRAFT_DIR = path.join(DATA_DIR, 'minecraft');
const PLUGINS_FILE = path.join(MINECRAFT_DIR, 'plugins.json');
const METADATA_FILE = path.join(MINECRAFT_DIR, 'metadata.json');

console.log('🔍 Analyzing Minecraft plugins data...\n');

// Load existing data
const existing = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
const plugins = existing.plugins || [];

console.log(`📊 Before deduplication:`);
console.log(`   - Total plugins: ${plugins.length}`);

// Count repos
const repos = new Map();
plugins.forEach(p => {
  if (p.repo) {
    if (repos.has(p.repo)) repos.set(p.repo, repos.get(p.repo) + 1);
    else repos.set(p.repo, 1);
  }
});

const duplicates = Array.from(repos.entries()).filter(([repo, count]) => count > 1);
console.log(`   - Unique GitHub repos: ${repos.size}`);
console.log(`   - Duplicate repos: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log(`\n🔧 Deduplicating by GitHub repo...`);
  
  // Deduplicate by GitHub repo: keep one entry per unique GitHub repository
  const deduplicatedPlugins = [];
  const repoMap = new Map();
  
  for (const plugin of plugins) {
    if (plugin.repo) {
      const existing = repoMap.get(plugin.repo);
      if (existing) {
        // Merge sources if the same repo appears on multiple platforms
        if (!existing.sources) {
          existing.sources = [existing.source];
        }
        if (existing.source && !existing.sources.includes(existing.source)) {
          existing.sources.push(existing.source);
        }
        if (plugin.source && !existing.sources.includes(plugin.source)) {
          existing.sources.push(plugin.source);
        }
        // Keep the one with more downloads (usually the most popular version)
        if (plugin.downloadCount > (existing.downloadCount || 0)) {
          Object.assign(existing, plugin);
        }
      } else {
        repoMap.set(plugin.repo, { ...plugin, sources: plugin.source ? [plugin.source] : [] });
        deduplicatedPlugins.push(repoMap.get(plugin.repo));
      }
    } else {
      // Plugins without GitHub repos are kept as-is
      deduplicatedPlugins.push(plugin);
    }
  }
  
  console.log(`\n📊 After deduplication:`);
  console.log(`   - Total plugins: ${deduplicatedPlugins.length}`);
  console.log(`   - Removed duplicates: ${plugins.length - deduplicatedPlugins.length}`);
  console.log(`   - Deduplication rate: ${((plugins.length - deduplicatedPlugins.length) / plugins.length * 100).toFixed(1)}%`);
  
  // Create metadata
  const pluginsWithStats = deduplicatedPlugins.filter(p => p.githubStats);
  const pluginsWithRepos = deduplicatedPlugins.filter(p => p.repo);
  
  // Calculate stats by mod type and loader
  const modTypes = { client: 0, server: 0, both: 0 };
  const loaders = { fabric: 0, forge: 0, quilt: 0, spigot: 0, paper: 0, bukkit: 0 };
  const sources = { modrinth: 0, curseforge: 0, spiget: 0 };
  
  deduplicatedPlugins.forEach(plugin => {
    if (plugin.modType) modTypes[plugin.modType]++;
    if (plugin.loader) loaders[plugin.loader]++;
    if (plugin.source) sources[plugin.source]++;
  });
  
  const metadata = {
    platform: 'minecraft',
    totalCount: deduplicatedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalDownloads: deduplicatedPlugins.reduce((sum, p) => sum + (p.downloadCount || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: deduplicatedPlugins.filter(p => p.rating).length > 0
        ? deduplicatedPlugins.filter(p => p.rating).reduce((sum, p) => sum + p.rating, 0) / deduplicatedPlugins.filter(p => p.rating).length
        : 0,
      modTypes: modTypes,
      loaders: loaders,
      sources: sources
    }
  };
  
  // Save deduplicated data
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: deduplicatedPlugins }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  console.log(`\n✅ Deduplication complete!`);
  console.log(`💾 Saved to ${MINECRAFT_DIR}/`);
  console.log(`   - plugins.json (${deduplicatedPlugins.length} plugins)`);
  console.log(`   - metadata.json`);
} else {
  console.log(`\n✅ No duplicates found - data is already clean!`);
}

