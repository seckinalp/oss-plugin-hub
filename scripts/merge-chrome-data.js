import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const CHROME_DIR = path.join(DATA_DIR, 'chrome');
const PLUGINS_FILE = path.join(CHROME_DIR, 'plugins.json');
const METADATA_FILE = path.join(CHROME_DIR, 'metadata.json');
const CWSDB_DATA = path.join(__dirname, 'chrome-extensions-cwsdb-data.json');

console.log('🚀 Merging Chrome extension data from CWS Database...\n');

try {
  // Load existing plugins (with GitHub repos)
  const existingData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
  const existingPlugins = existingData.plugins || [];
  
  // Load CWS Database data
  const cwsdbData = JSON.parse(fs.readFileSync(CWSDB_DATA, 'utf8'));
  
  console.log(`📦 Existing plugins: ${existingPlugins.length}`);
  console.log(`📦 CWS Database entries: ${cwsdbData.length}\n`);
  
  // Create a map of existing plugins by name (normalized)
  const existingMap = new Map();
  existingPlugins.forEach(plugin => {
    const normalizedName = plugin.name.toLowerCase().trim();
    existingMap.set(normalizedName, plugin);
  });
  
  // Merge data
  const mergedPlugins = [];
  let newCount = 0;
  let updatedCount = 0;
  
  cwsdbData.forEach(cwsEntry => {
    const normalizedName = cwsEntry.name.toLowerCase().trim();
    const existing = existingMap.get(normalizedName);
    
    if (existing) {
      // Update existing plugin with new user data
      mergedPlugins.push({
        ...existing,
        users: cwsEntry.users,
        downloads: cwsEntry.users,
        rating: cwsEntry.rating,
        ratingCount: cwsEntry.reviews,
        downloadStatsUpdated: new Date().toISOString()
      });
      updatedCount++;
      existingMap.delete(normalizedName); // Remove so we don't add it again
    } else if (cwsEntry.repo) {
      // New plugin with GitHub repo
      newCount++;
      mergedPlugins.push({
        id: `chrome-${cwsEntry.extensionId || cwsEntry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: cwsEntry.name,
        author: 'Unknown',
        description: cwsEntry.description || '',
        repo: cwsEntry.repo,
        platform: 'chrome',
        extensionId: cwsEntry.extensionId || null,
        storeUrl: cwsEntry.extensionId ? `https://chrome.google.com/webstore/detail/${cwsEntry.extensionId}` : null,
        users: cwsEntry.users,
        downloads: cwsEntry.users,
        rating: cwsEntry.rating,
        ratingCount: cwsEntry.reviews,
        downloadStatsUpdated: new Date().toISOString()
      });
    }
  });
  
  // Add remaining existing plugins that weren't in CWS DB data
  existingMap.forEach(plugin => {
    mergedPlugins.push(plugin);
  });
  
  // Sort by users descending
  mergedPlugins.sort((a, b) => (b.users || 0) - (a.users || 0));
  
  console.log(`✓ Merged ${mergedPlugins.length} total plugins`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Kept from existing: ${existingMap.size}\n`);
  
  // Filter to only those with GitHub repos
  const withGitHub = mergedPlugins.filter(p => p.repo);
  console.log(`📊 Extensions with GitHub repos: ${withGitHub.length}\n`);
  
  // Show top 20
  console.log('📊 Top 20 Chrome extensions by users:');
  withGitHub.slice(0, 20).forEach((ext, i) => {
    const users = ext.users >= 1000000 
      ? (ext.users / 1000000).toFixed(1) + 'M'
      : ext.users >= 1000
      ? (ext.users / 1000).toFixed(0) + 'K'
      : ext.users;
    console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${ext.name.padEnd(50, ' ')} ${users.padStart(8, ' ')} users`);
  });
  
  // Create metadata
  const metadata = {
    platform: 'chrome',
    totalCount: withGitHub.length,
    lastUpdated: new Date().toISOString(),
    dataSource: 'CWS Database + Curated List',
    pluginsWithGitHubRepos: withGitHub.length,
    stats: {
      totalUsers: withGitHub.reduce((sum, p) => sum + (p.users || 0), 0),
      averageRating: withGitHub.filter(p => p.rating > 0).reduce((sum, p) => sum + p.rating, 0) / withGitHub.filter(p => p.rating > 0).length || 0,
      totalReviews: withGitHub.reduce((sum, p) => sum + (p.ratingCount || 0), 0)
    }
  };
  
  // Save
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: withGitHub }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  console.log(`\n💾 Saved to ${CHROME_DIR}/`);
  console.log(`   - plugins.json (${withGitHub.length} extensions)`);
  console.log(`   - metadata.json`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total extensions: ${withGitHub.length}`);
  console.log(`   - Total users: ${(metadata.stats.totalUsers / 1000000).toFixed(1)}M`);
  console.log(`   - Average rating: ${metadata.stats.averageRating.toFixed(2)}`);
  console.log(`   - Total reviews: ${(metadata.stats.totalReviews / 1000).toFixed(0)}K`);
  console.log(`\n✅ Chrome extension data merged successfully!`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Run "npm run update-stats:chrome" to fetch GitHub stats`);
  console.log(`   2. Run "npm run fetch-download-stats" to identify top 100`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}

