const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const VSCODE_MARKETPLACE_API = 'marketplace.visualstudio.com';
const DATA_DIR = path.join(__dirname, '../data');
const VSCODE_DIR = path.join(DATA_DIR, 'vscode');
const PLUGINS_FILE = path.join(VSCODE_DIR, 'plugins.json');
const METADATA_FILE = path.join(VSCODE_DIR, 'metadata.json');

// Fetch settings - configurable
// Note: VS Code Marketplace has 50,000+ extensions total
// Set to fetch ALL extensions with GitHub repos
const MAX_PAGES = parseInt(process.env.VSCODE_MAX_PAGES) || 500; // 500 pages = 50,000 extensions (all)
const PAGE_SIZE = 100; // Max allowed by API
const GITHUB_ONLY = process.env.VSCODE_GITHUB_ONLY !== 'false'; // Default: only fetch extensions with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VSCODE_DIR)) {
  fs.mkdirSync(VSCODE_DIR, { recursive: true });
}

/**
 * Fetch VS Code extensions from the marketplace
 * This uses the public VS Code Marketplace API
 */
function fetchVSCodeExtensions(pageNumber = 1, pageSize = 100) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      filters: [
        {
          criteria: [
            { filterType: 8, value: "Microsoft.VisualStudio.Code" },
            { filterType: 10, value: 'target:"Microsoft.VisualStudio.Code"' },
            { filterType: 12, value: "37888" } // Verified publisher
          ],
          pageNumber: pageNumber,
          pageSize: pageSize,
          sortBy: 4, // Sort by installs
          sortOrder: 2 // Descending
        }
      ],
      assetTypes: [],
      flags: 914
    });

    const options = {
      hostname: VSCODE_MARKETPLACE_API,
      path: '/_apis/public/gallery/extensionquery',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=3.0-preview.1',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Parse VS Code extension to our plugin format
 */
function parseVSCodeExtension(ext) {
  const publisher = ext.publisher.displayName || ext.publisher.publisherName;
  const name = ext.displayName;
  const extensionId = `${ext.publisher.publisherName}.${ext.extensionName}`;
  
  // Extract repository URL from properties
  let repo = null;
  if (ext.versions && ext.versions[0] && ext.versions[0].properties) {
    const repoProperty = ext.versions[0].properties.find(p => 
      p.key === 'Microsoft.VisualStudio.Services.Links.Source' ||
      p.key === 'Microsoft.VisualStudio.Services.Links.Repository'
    );
    if (repoProperty && repoProperty.value) {
      // Extract owner/repo from GitHub URL
      const match = repoProperty.value.match(/github\.com\/([^\/]+\/[^\/]+)/);
      if (match) {
        repo = match[1].replace(/\.git$/, '');
      }
    }
  }

  // Get statistics
  const statistics = ext.statistics || [];
  const installs = statistics.find(s => s.statisticName === 'install')?.value || 0;
  const rating = statistics.find(s => s.statisticName === 'averagerating')?.value || 0;
  const ratingCount = statistics.find(s => s.statisticName === 'ratingcount')?.value || 0;

  return {
    id: extensionId.toLowerCase(),
    name: name,
    author: publisher,
    description: ext.shortDescription || '',
    repo: repo,
    platform: 'vscode',
    extensionId: extensionId,
    publishedDate: ext.publishedDate,
    lastUpdated: ext.lastUpdated,
    releaseDate: ext.releaseDate,
    downloadUrl: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`,
    installs: installs,
    rating: rating,
    ratingCount: ratingCount,
    categories: ext.categories || [],
    tags: ext.tags || []
  };
}

/**
 * Fetch multiple pages of extensions
 */
async function fetchAllVSCodeExtensions(maxPages = 10, pageSize = 100) {
  const allExtensions = [];
  
  console.log(`📥 Fetching VS Code extensions (up to ${maxPages} pages)...`);
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`   Fetching page ${page}/${maxPages}...`);
      const result = await fetchVSCodeExtensions(page, pageSize);
      
      if (result.results && result.results[0] && result.results[0].extensions) {
        const extensions = result.results[0].extensions;
        
        if (extensions.length === 0) {
          console.log('   No more extensions found');
          break;
        }
        
        allExtensions.push(...extensions);
        console.log(`   ✓ Fetched ${extensions.length} extensions`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page}:`, error.message);
      break;
    }
  }
  
  return allExtensions;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(vscodePlugins) {
  // Load existing plugins to preserve GitHub stats
  let existingPlugins = [];
  if (fs.existsSync(PLUGINS_FILE)) {
    const existing = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    existingPlugins = existing.plugins || [];
  }
  
  // Create map of existing plugins with GitHub stats
  const existingMap = new Map();
  existingPlugins.forEach(p => existingMap.set(p.id, p));
  
  // Merge: keep GitHub stats from existing plugins
  const mergedPlugins = vscodePlugins.map(plugin => {
    const existing = existingMap.get(plugin.id);
    if (existing && existing.githubStats) {
      return {
        ...plugin,
        githubStats: existing.githubStats,
        githubDataFetchedAt: existing.githubDataFetchedAt
      };
    }
    return plugin;
  });
  
  // Create metadata
  const pluginsWithStats = mergedPlugins.filter(p => p.githubStats);
  const pluginsWithRepos = mergedPlugins.filter(p => p.repo);
  const metadata = {
    platform: 'vscode',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalInstalls: mergedPlugins.reduce((sum, p) => sum + (p.installs || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: mergedPlugins.filter(p => p.rating).length > 0
        ? mergedPlugins.filter(p => p.rating).reduce((sum, p) => sum + p.rating, 0) / mergedPlugins.filter(p => p.rating).length
        : 0,
    }
  };
  
  // Save files
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: mergedPlugins }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  return { plugins: mergedPlugins, metadata };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting VS Code extension fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Max pages: ${MAX_PAGES} (fetching up to ${MAX_PAGES * PAGE_SIZE} extensions)`);
  console.log(`   - Page size: ${PAGE_SIZE}`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to extensions with GitHub repos' : 'will include all extensions'})`);
  console.log(`   - Note: VS Code has 50,000+ total extensions`);
  console.log(`   - Set VSCODE_MAX_PAGES env var to limit pages (default: 500 for all)`);
  console.log(`   - Set VSCODE_GITHUB_ONLY=false to include extensions without GitHub repos\n`);
  
  try {
    // Fetch VS Code extensions
    const rawExtensions = await fetchAllVSCodeExtensions(MAX_PAGES, PAGE_SIZE);
    console.log(`\n✓ Fetched ${rawExtensions.length} total VS Code extensions\n`);
    
    // Parse to our format
    console.log('🔄 Parsing extensions...');
    const allParsedPlugins = rawExtensions.map(parseVSCodeExtension);
    
    // Filter based on GitHub-only setting
    let vscodePlugins;
    if (GITHUB_ONLY) {
      vscodePlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} extensions`);
      console.log(`   - With GitHub repos: ${vscodePlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - vscodePlugins.length} (filtered out)\n`);
    } else {
      vscodePlugins = allParsedPlugins;
      const withRepos = vscodePlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${vscodePlugins.length} extensions`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${vscodePlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by installs
    console.log('📊 Top 10 VS Code extensions by installs:');
    const sorted = [...vscodePlugins].sort((a, b) => b.installs - a.installs).slice(0, 10);
    sorted.forEach((ext, i) => {
      const installs = (ext.installs / 1000000).toFixed(1) + 'M';
      console.log(`   ${i + 1}. ${ext.name} by ${ext.author} (${installs} installs)`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(vscodePlugins);
    
    console.log(`✓ Saved to ${VSCODE_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} extensions)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 VS Code Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total installs: ${(result.metadata.stats.totalInstalls / 1000000).toFixed(1)}M`);
    console.log('\n✅ VS Code extension fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching VS Code extensions:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

