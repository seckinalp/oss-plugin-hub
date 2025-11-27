import https from 'https';

const packagesToAdd = [
  // Chrome repos to test
  { name: 'Privacy Badger', repo: 'EFForg/privacybadger' },
  { name: 'Decentraleyes', repo: 'Synzvato/decentraleyes' },
  { name: 'HTTPS Everywhere', repo: 'EFForg/https-everywhere' },
  { name: 'Octotree', repo: 'ovity/octotree' },
  { name: 'Refined GitHub', repo: 'refined-github/refined-github' },
  { name: 'Vue.js devtools', repo: 'vuejs/devtools' },
  { name: 'Augmented Steam', repo: 'tfedor/AugmentedSteam' },
  { name: 'Redirector', repo: 'einaregilsson/Redirector' },
  { name: 'LeechBlock NG', repo: 'proginosko/LeechBlockNG' },
  { name: 'GitHub Repository Size', repo: 'harshjv/github-repo-size' },
  { name: 'uBlacklist', repo: 'iorate/ublacklist' },
  { name: 'Automa', repo: 'AutomaApp/automa' },
  { name: 'Screenity', repo: 'alyssaxuu/screenity' },
  { name: 'Apollo Client Devtools', repo: 'apollographql/apollo-client-devtools' },
  { name: 'rikaikun', repo: 'melink14/rikaikun' },
  { name: 'Mailvelope', repo: 'mailvelope/mailvelope' },
  { name: 'Stylebot', repo: 'ankit/stylebot' },
  { name: 'Web Server for Chrome', repo: 'kzahel/web-server-chrome' },
  { name: 'AdGuard Extra', repo: 'AdguardTeam/AdguardExtra' },
  { name: 'Old Reddit Redirect', repo: 'tom-james-watson/old-reddit-redirect' },
  { name: 'NoScript', repo: 'hackademix/noscript' },
  { name: 'Hoppscotch Browser Extension', repo: 'hoppscotch/hoppscotch-extension' },
  { name: 'WebToEpub', repo: 'dteviot/WebToEpub' },
  { name: 'Pixiv Toolkit', repo: 'pixiv-toolkit/pixiv-toolkit' },
  { name: 'BlockTube', repo: 'amitbl/blocktube' },
  { name: 'Dimensions', repo: 'mrflix/dimensions' },
  { name: 'Mouse Dictionary', repo: 'wtetsu/mouse-dictionary' },
  { name: 'Disable automatic tab discarding', repo: 'Hau-Hau/chrome-tab-suspend' },
  { name: 'SubWallet', repo: 'Koniverse/SubWallet-Extension' },
];

function checkRepo(repo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}`,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Node.js'
      }
    };

    const req = https.request(options, (res) => {
      resolve({
        repo,
        status: res.statusCode,
        exists: res.statusCode === 200
      });
    });

    req.on('error', () => {
      resolve({ repo, status: 'ERROR', exists: false });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ repo, status: 'TIMEOUT', exists: false });
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Testing GitHub repositories...\n');
  
  const results = [];
  
  for (const pkg of packagesToAdd) {
    process.stdout.write(`Testing ${pkg.name}...`);
    const result = await checkRepo(pkg.repo);
    results.push({ ...pkg, ...result });
    
    if (result.exists) {
      console.log(' ✅');
    } else {
      console.log(` ❌ (${result.status})`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const valid = results.filter(r => r.exists);
  const invalid = results.filter(r => !r.exists);
  
  console.log('\n' + '='.repeat(60));
  console.log(`Valid repos: ${valid.length}/${packagesToAdd.length}`);
  console.log(`Invalid repos: ${invalid.length}/${packagesToAdd.length}`);
  console.log('='.repeat(60));
  
  if (invalid.length > 0) {
    console.log('\n❌ Invalid repositories:\n');
    invalid.forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    Repo: ${r.repo} (${r.status})`);
    });
  }
}

main();

