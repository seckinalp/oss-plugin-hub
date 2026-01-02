const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const HOMEASSISTANT_DIR = path.join(DATA_DIR, 'homeassistant');
const PLUGINS_FILE = path.join(HOMEASSISTANT_DIR, 'plugins.json');
const METADATA_FILE = path.join(HOMEASSISTANT_DIR, 'metadata.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(HOMEASSISTANT_DIR)) {
  fs.mkdirSync(HOMEASSISTANT_DIR, { recursive: true });
}

/**
 * Fetch Home Assistant custom components from HACS default repository
 * Uses the official hacs/default repository as the source of truth
 */
function fetchHomeAssistantComponents() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Fetching Home Assistant components from HACS default repository...');
    
    // HACS default repository URLs (these are plain text files with one repo per line)
    const hacsUrls = [
      'https://raw.githubusercontent.com/hacs/default/master/integration',
      'https://raw.githubusercontent.com/hacs/default/master/theme',
      'https://raw.githubusercontent.com/hacs/default/master/appdaemon',
      'https://raw.githubusercontent.com/hacs/default/master/python_script',
      'https://raw.githubusercontent.com/hacs/default/master/template',
      'https://raw.githubusercontent.com/hacs/default/master/plugin',
      'https://raw.githubusercontent.com/hacs/default/master/netdaemon'
    ];
    
    const allComponents = [];
    let completedRequests = 0;
    
    hacsUrls.forEach((url, index) => {
      const category = url.split('/').pop().replace('.json', '');
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              // Parse plain text file with one repository per line
              const repositories = data.trim().split('\n').filter(line => line.trim());
              console.log(`✓ Fetched ${repositories.length} ${category} components`);
              
              // Process each repository
              repositories.forEach(repository => {
                const repoParts = repository.trim().split('/');
                if (repoParts.length === 2) {
                  allComponents.push({
                    id: repository.toLowerCase().replace('/', '-'),
                    name: repoParts[1], // Use repository name as component name
                    author: repoParts[0],
                    description: `Home Assistant ${category} component`, // Generic description
                    repo: repository,
                    platform: 'homeassistant',
                    category: category,
                    downloads: 0, // HACS doesn't provide download counts
                    stars: 0, // Will be filled by GitHub stats later
                    lastUpdated: new Date().toISOString(),
                    version: '1.0.0', // Default version
                    homeassistantVersion: '2023.1.0', // Default HA version
                    manifest: null, // Not available in plain text format
                    documentation: `https://github.com/${repository}`
                  });
                }
              });
              
            } catch (error) {
              console.error(`⚠️  Error parsing ${category} data:`, error.message);
            }
          } else {
            console.error(`⚠️  Error fetching ${category}: HTTP ${res.statusCode}`);
          }
          
          completedRequests++;
          if (completedRequests === hacsUrls.length) {
            console.log(`✓ Total components fetched: ${allComponents.length}`);
            resolve(allComponents);
          }
        });
      }).on('error', (error) => {
        console.error(`⚠️  Error fetching ${category}:`, error.message);
        completedRequests++;
        if (completedRequests === hacsUrls.length) {
          console.log(`✓ Total components fetched: ${allComponents.length}`);
          resolve(allComponents);
        }
      });
    });
  });
}

/**
 * Parse Home Assistant component to our plugin format
 */
function parseHomeAssistantComponent(component) {
  return {
    id: component.id,
    name: component.name,
    author: component.author,
    description: component.description,
    repo: component.repo,
    platform: 'homeassistant',
    category: component.category,
    downloads: component.downloads || 0,
    stars: component.stars || 0,
    lastUpdated: component.lastUpdated,
    version: component.version,
    homeassistantVersion: component.homeassistantVersion,
    downloadUrl: `https://github.com/${component.repo}`,
    rating: 0, // HACS doesn't have ratings like VS Code
    ratingCount: 0,
    categories: [component.category],
    tags: []
  };
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(homeassistantPlugins) {
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
  const mergedPlugins = homeassistantPlugins.map(plugin => {
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
    platform: 'homeassistant',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalInstalls: mergedPlugins.reduce((sum, p) => sum + (p.downloads || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: 0 // HACS doesn't have ratings
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
  console.log('🚀 Starting Home Assistant component fetch...\n');
  console.log('📝 Using official HACS default repository as source of truth\n');
  
  try {
    // Fetch Home Assistant components
    const rawComponents = await fetchHomeAssistantComponents();
    console.log(`✓ Fetched ${rawComponents.length} Home Assistant components\n`);
    
    // Parse to our format
    console.log('🔄 Parsing components...');
    const homeassistantPlugins = rawComponents.map(parseHomeAssistantComponent);
    console.log(`✓ Parsed ${homeassistantPlugins.length} components\n`);
    
    // Show breakdown by category
    const categories = {};
    homeassistantPlugins.forEach(plugin => {
      categories[plugin.category] = (categories[plugin.category] || 0) + 1;
    });
    
    console.log('📊 Components by category:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} components`);
    });
    console.log('');
    
    // Show sample components
    console.log('📊 Sample components:');
    homeassistantPlugins.slice(0, 10).forEach((comp, i) => {
      console.log(`   ${i + 1}. ${comp.name} by ${comp.author} (${comp.category})`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(homeassistantPlugins);
    
    console.log(`✓ Saved to ${HOMEASSISTANT_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} components)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Home Assistant Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total stars: ${result.metadata.stats.totalStars}`);
    console.log('\n✅ Home Assistant component fetch completed!');
    console.log('\n📝 Note: This uses the official HACS default repository');
    console.log('   Run "npm run update-stats:homeassistant" to fetch GitHub stats');
    
  } catch (error) {
    console.error('\n❌ Error fetching Home Assistant components:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
