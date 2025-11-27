import fs from 'fs';

const platforms = ['obsidian', 'vscode', 'minecraft', 'firefox', 'wordpress', 'homeassistant', 'jetbrains', 'sublime', 'chrome'];

console.log('🔍 Checking for plugins still missing GitHub data...\n');

let totalMissing = 0;
const missingPlugins = [];

platforms.forEach(platform => {
  const data = JSON.parse(fs.readFileSync(`data/${platform}/plugins.json`, 'utf8'));
  const top100 = data.plugins.filter(p => p.isTop100);
  const missing = top100.filter(p => !p.githubStats || Object.keys(p.githubStats).length === 0);
  
  if (missing.length > 0) {
    console.log(`${platform.padEnd(15)} - ${missing.length} missing`);
    missing.forEach(p => {
      console.log(`  ❌ ${p.name}`);
      console.log(`     Repo: ${p.repo}`);
      missingPlugins.push({ platform, ...p });
    });
    console.log('');
    totalMissing += missing.length;
  } else {
    console.log(`${platform.padEnd(15)} - ✅ All ${top100.length} have GitHub data`);
  }
});

console.log('='.repeat(60));
console.log(`Total missing: ${totalMissing}`);
console.log('='.repeat(60));

if (totalMissing > 0) {
  console.log('\n📝 Saving list of missing plugins to missing-repos.json\n');
  fs.writeFileSync('missing-repos.json', JSON.stringify(missingPlugins, null, 2));
}

