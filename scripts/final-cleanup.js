import fs from 'fs';

const platforms = ['obsidian', 'vscode', 'minecraft', 'firefox', 'wordpress', 'homeassistant', 'jetbrains', 'sublime', 'chrome'];

console.log('🔧 Final cleanup - removing plugins without GitHub data...\n');

let totalRemoved = 0;

platforms.forEach(platform => {
  const data = JSON.parse(fs.readFileSync(`data/${platform}/plugins.json`, 'utf8'));
  
  // Get all plugins with GitHub data, sorted by downloads
  const allWithGithub = data.plugins
    .filter(p => {
      const hasStats = p.githubStats && Object.keys(p.githubStats).length > 0;
      const hasDownloads = p.downloads || p.users || p.installs || p.downloadCount || p.activeInstalls || p.unique_installs;
      return hasStats && hasDownloads;
    })
    .sort((a, b) => {
      const aDownloads = a.downloads || a.users || a.installs || a.downloadCount || a.activeInstalls || a.unique_installs || 0;
      const bDownloads = b.downloads || b.users || b.installs || b.downloadCount || b.activeInstalls || b.unique_installs || 0;
      return bDownloads - aDownloads;
    });
  
  const beforeCount = data.plugins.filter(p => p.isTop100).length;
  const targetCount = Math.min(100, allWithGithub.length);
  
  // Get top N with GitHub data
  const newTop = allWithGithub.slice(0, targetCount);
  const newTopIds = new Set(newTop.map(p => p.id));
  
  // Update plugins
  const updated = data.plugins.map(p => ({
    ...p,
    isTop100: newTopIds.has(p.id)
  }));
  
  const afterCount = updated.filter(p => p.isTop100).length;
  const removed = beforeCount - afterCount;
  
  if (removed > 0 || afterCount !== beforeCount) {
    console.log(`${platform.padEnd(15)} - ${beforeCount} → ${afterCount} (removed ${removed})`);
    totalRemoved += removed;
  } else {
    console.log(`${platform.padEnd(15)} - ✅ ${afterCount} (no changes)`);
  }
  
  // Save
  fs.writeFileSync(`data/${platform}/plugins.json`, JSON.stringify({ plugins: updated }, null, 2));
  
  // Update top100.json
  fs.writeFileSync(`data/${platform}/top100.json`, JSON.stringify({
    platform,
    generatedAt: new Date().toISOString(),
    totalPlugins: data.plugins.length,
    top100: newTop.map(p => ({
      id: p.id,
      name: p.name,
      author: p.author,
      description: p.description,
      repo: p.repo,
      downloads: p.downloads || p.users || p.installs || p.downloadCount || p.activeInstalls || p.unique_installs || 0,
      stars: p.githubStats?.stars || 0,
      lastUpdated: p.githubStats?.lastUpdated || p.lastUpdated,
      isTop100: true
    }))
  }, null, 2));
});

console.log('\n' + '='.repeat(60));
console.log(`Total removed: ${totalRemoved}`);
console.log('='.repeat(60));
console.log('\n✅ All platforms cleaned up! Verifying...\n');

// Final verification
let total = 0;
let withGithub = 0;

platforms.forEach(platform => {
  const data = JSON.parse(fs.readFileSync(`data/${platform}/plugins.json`, 'utf8'));
  const top100 = data.plugins.filter(p => p.isTop100);
  const withStats = top100.filter(p => p.githubStats && Object.keys(p.githubStats).length > 0);
  
  console.log(`${platform.padEnd(15)}: ${withStats.length}/${top100.length} have GitHub data`);
  total += top100.length;
  withGithub += withStats.length;
});

console.log('\n' + '='.repeat(60));
console.log(`📊 FINAL TOTAL: ${withGithub}/${total} plugins with GitHub data (${((withGithub/total)*100).toFixed(1)}%)`);
console.log('='.repeat(60));

