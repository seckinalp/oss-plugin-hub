import fs from 'fs';

console.log('📦 Adding packages from packages-to-add.json...\n');

// Read the packages to add
const packagesToAdd = JSON.parse(fs.readFileSync('packages-to-add.json', 'utf8'));

let totalAdded = 0;

for (const [platform, packages] of Object.entries(packagesToAdd)) {
  if (!packages || packages.length === 0) continue;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${platform.toUpperCase()}`);
  console.log('='.repeat(60));
  
  const pluginsFile = `data/${platform}/plugins.json`;
  
  if (!fs.existsSync(pluginsFile)) {
    console.log(`⚠️  ${pluginsFile} not found, skipping...`);
    continue;
  }
  
  const data = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  let platformAdded = 0;
  
  packages.forEach(pkg => {
    // Check if already exists by repo
    const exists = data.plugins.find(p => p.repo === pkg.repo);
    if (exists) {
      console.log(`⚠️  ${pkg.name} already exists`);
      console.log(`   ID: ${exists.id}`);
      console.log(`   Current downloads: ${exists.downloads || 0}`);
      console.log('');
      return;
    }
    
    // Create ID based on platform and repo
    const id = `${platform}-${pkg.repo.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    
    // Create new plugin
    const newPlugin = {
      id,
      name: pkg.name,
      author: pkg.repo.split('/')[0],
      description: pkg.description || `${pkg.name} plugin`,
      repo: pkg.repo,
      platform,
      homepage: `https://github.com/${pkg.repo}`,
      downloads: pkg.downloads || 0,
      lastUpdated: new Date().toISOString(),
      downloadStatsUpdated: new Date().toISOString(),
      isTop100: false // Will be set to true after sorting by downloads
    };
    
    // Add platform-specific fields
    if (platform === 'sublime') {
      newPlugin.packageName = pkg.name;
      newPlugin.unique_installs = pkg.downloads || 0;
    } else if (platform === 'vscode') {
      newPlugin.installs = pkg.downloads || 0;
      newPlugin.publisher = pkg.repo.split('/')[0];
      newPlugin.extensionId = id;
    } else if (platform === 'chrome' || platform === 'firefox') {
      newPlugin.users = pkg.downloads || 0;
    }
    
    data.plugins.push(newPlugin);
    platformAdded++;
    totalAdded++;
    
    console.log(`✅ Added: ${pkg.name}`);
    console.log(`   ID: ${id}`);
    console.log(`   Repo: ${pkg.repo}`);
    console.log(`   Downloads: ${pkg.downloads || 0}`);
    console.log('');
  });
  
  if (platformAdded > 0) {
    // Save
    fs.writeFileSync(pluginsFile, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${platformAdded} new ${platform} package(s)`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`✅ Total added: ${totalAdded} package(s)`);
console.log('='.repeat(60));

if (totalAdded > 0) {
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run fetch-download-stats');
  console.log('   (to identify top 100 for each platform)');
  console.log('2. Run: npm run update-stats');
  console.log('   (to fetch GitHub data for new packages)\n');
} else {
  console.log('\n⚠️  No new packages were added\n');
}

