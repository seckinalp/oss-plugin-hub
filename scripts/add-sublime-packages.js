import fs from 'fs';

// Add new Sublime packages with working GitHub repos
// Replace these with the actual packages you want to add
const newPackages = [
  {
    name: 'ColorPicker',
    repo: 'weslly/ColorPicker',
    downloads: 1150000, // Approximate from Package Control
    description: 'A multi-platform color picker plugin for Sublime Text'
  }
  // Add more packages here - just provide: name, repo, downloads (estimate), description
];

console.log('📦 Adding new Sublime packages...\n');

const data = JSON.parse(fs.readFileSync('data/sublime/plugins.json', 'utf8'));

let added = 0;

newPackages.forEach(pkg => {
  // Check if already exists
  const exists = data.plugins.find(p => p.repo === pkg.repo);
  if (exists) {
    console.log(`⚠️  ${pkg.name} already exists (${exists.id})`);
    return;
  }
  
  // Create new plugin
  const newPlugin = {
    id: `sublime-${pkg.repo.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
    name: pkg.name,
    author: pkg.repo.split('/')[0],
    description: pkg.description,
    repo: pkg.repo,
    platform: 'sublime',
    packageName: pkg.name,
    homepage: `https://github.com/${pkg.repo}`,
    downloads: pkg.downloads || 0,
    unique_installs: pkg.downloads || 0,
    lastUpdated: new Date().toISOString(),
    downloadStatsUpdated: new Date().toISOString(),
    isTop100: true // Mark as top 100 initially
  };
  
  data.plugins.push(newPlugin);
  added++;
  
  console.log(`✅ Added: ${pkg.name}`);
  console.log(`   Repo: ${pkg.repo}`);
  console.log(`   Downloads: ${pkg.downloads}`);
  console.log('');
});

if (added > 0) {
  // Save
  fs.writeFileSync('data/sublime/plugins.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Added ${added} new Sublime package(s)`);
  console.log('\nNext steps:');
  console.log('1. Run: npm run update-stats:sublime');
  console.log('2. This will fetch GitHub data for the new packages\n');
} else {
  console.log('\n⚠️  No new packages added\n');
}

