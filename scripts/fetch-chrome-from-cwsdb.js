import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const CHROME_DIR = path.join(DATA_DIR, 'chrome');
const PLUGINS_FILE = path.join(CHROME_DIR, 'plugins.json');
const METADATA_FILE = path.join(CHROME_DIR, 'metadata.json');

// CWS Database API/endpoint
const CWS_DB_BASE = 'cws-database.com';
const GITHUB_ONLY = process.env.CHROME_GITHUB_ONLY !== 'false';

// How many extensions to fetch (we want top by users)
const MAX_EXTENSIONS = parseInt(process.env.CHROME_MAX_EXTENSIONS) || 200; // Fetch 200 to ensure we get 100+ with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CHROME_DIR)) {
  fs.mkdirSync(CHROME_DIR, { recursive: true });
}

/**
 * Fetch from CWS Database API
 */
function fetchCWSData(offset = 0, limit = 100) {
  return new Promise((resolve, reject) => {
    // Try to fetch from their explore endpoint
    // Sorted by users (most popular first)
    const path = `/api/extensions?limit=${limit}&offset=${offset}&sort=-users`;
    
    const options = {
      hostname: CWS_DB_BASE,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OSS-Plugin-Hub-Research/1.0'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            // If JSON parsing fails, might be HTML - try alternative
            console.log('   ⚠️  JSON parse failed, trying alternative format...');
            resolve({ extensions: [], total: 0 });
          }
        } else {
          console.log(`   ⚠️  HTTP ${res.statusCode}, trying alternative approach...`);
          resolve({ extensions: [], total: 0 });
        }
      });
    }).on('error', (error) => {
      console.log(`   ⚠️  Request failed: ${error.message}`);
      resolve({ extensions: [], total: 0 });
    }).end();
  });
}

/**
 * Parse extension to our format
 */
function parseExtension(ext) {
  // Try to find GitHub repo from website or description
  let repo = null;
  
  // Check website field
  if (ext.website) {
    const match = ext.website.match(/github\.com\/([^\/]+\/[^\/\?#]+)/);
    if (match) {
      repo = match[1].replace(/\.git$/, '');
    }
  }
  
  // Check homepage or support URL
  if (!repo && ext.homepage) {
    const match = ext.homepage.match(/github\.com\/([^\/]+\/[^\/\?#]+)/);
    if (match) {
      repo = match[1].replace(/\.git$/, '');
    }
  }
  
  return {
    id: `chrome-${ext.id || ext.extensionId}`,
    name: ext.name || 'Unknown',
    author: ext.author || 'Unknown',
    description: ext.short_description || ext.description || '',
    repo: repo,
    platform: 'chrome',
    extensionId: ext.id || ext.extensionId,
    storeUrl: `https://chrome.google.com/webstore/detail/${ext.id || ext.extensionId}`,
    users: parseInt(ext.users || 0, 10),
    downloads: parseInt(ext.users || 0, 10), // Use users as downloads
    rating: parseFloat(ext.rating || 0),
    ratingCount: parseInt(ext.reviews || ext.ratingCount || 0, 10),
    version: ext.version || '1.0.0',
    lastUpdated: ext.updated_at || ext.lastUpdated || new Date().toISOString(),
    categories: ext.category ? [ext.category] : [],
    homepage: ext.website || null,
    manifestVersion: ext.manifest_version || 3
  };
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(chromePlugins) {
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
  const mergedPlugins = chromePlugins.map(plugin => {
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
    platform: 'chrome',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalUsers: mergedPlugins.reduce((sum, p) => sum + (p.users || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: mergedPlugins.filter(p => p.rating > 0).reduce((sum, p) => sum + p.rating, 0) / mergedPlugins.filter(p => p.rating > 0).length || 0
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
  console.log('🚀 Fetching Chrome extensions from CWS Database...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'}`);
  console.log(`   - Max extensions: ${MAX_EXTENSIONS}`);
  console.log(`   - Source: https://cws-database.com/\n`);
  
  try {
    console.log('📥 Fetching extension data from CWS Database API...');
    
    // Try fetching from API
    const limit = 100;
    let allExtensions = [];
    
    for (let offset = 0; offset < MAX_EXTENSIONS; offset += limit) {
      console.log(`   - Fetching batch at offset ${offset}...`);
      const result = await fetchCWSData(offset, limit);
      
      if (result.extensions && result.extensions.length > 0) {
        allExtensions.push(...result.extensions);
        console.log(`     ✓ Got ${result.extensions.length} extensions`);
      } else {
        console.log(`     ⚠️  No data received from API`);
        break;
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stop if we got less than requested (means we're at the end)
      if (!result.extensions || result.extensions.length < limit) {
        break;
      }
    }
    
    if (allExtensions.length === 0) {
      console.log('\n⚠️  CWS Database API not accessible or requires authentication');
      console.log('   Falling back to curated list from previous fetch...\n');
      
      // Load existing data if available
      if (fs.existsSync(PLUGINS_FILE)) {
        const existing = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
        console.log(`✓ Loaded ${existing.plugins.length} extensions from existing data\n`);
        console.log('📝 To expand this dataset:');
        console.log('   1. Check if CWS Database requires API key/authentication');
        console.log('   2. Or manually export data from https://cws-database.com/explore');
        console.log('   3. Or use Chrome Web Store scraping tools\n');
        return;
      } else {
        console.error('❌ No existing data found. Please run fetch-chrome first.');
        process.exit(1);
      }
    }
    
    console.log(`\n✓ Total extensions fetched: ${allExtensions.length}\n`);
    
    // Parse to our format
    console.log('🔄 Parsing extensions...');
    const parsedExtensions = allExtensions.map(parseExtension);
    
    // Filter by GitHub repos if needed
    let finalExtensions;
    if (GITHUB_ONLY) {
      finalExtensions = parsedExtensions.filter(e => e.repo !== null);
      console.log(`✓ Parsed ${parsedExtensions.length} extensions`);
      console.log(`   - With GitHub repos: ${finalExtensions.length} (kept)`);
      console.log(`   - Without GitHub repos: ${parsedExtensions.length - finalExtensions.length} (filtered out)\n`);
    } else {
      finalExtensions = parsedExtensions;
      const withRepos = finalExtensions.filter(e => e.repo !== null);
      console.log(`✓ Parsed ${finalExtensions.length} extensions`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${finalExtensions.length - withRepos.length}\n`);
    }
    
    // Show top 10 by users
    console.log('📊 Top 10 Chrome extensions by users:');
    const sorted = [...finalExtensions].sort((a, b) => b.users - a.users).slice(0, 10);
    sorted.forEach((ext, i) => {
      const users = ext.users >= 1000000 
        ? (ext.users / 1000000).toFixed(1) + 'M'
        : (ext.users / 1000).toFixed(0) + 'K';
      console.log(`   ${i + 1}. ${ext.name} - ${users} users`);
    });
    console.log('');
    
    // Save
    console.log('💾 Saving extensions and metadata...');
    const result = savePluginsAndMetadata(finalExtensions);
    
    console.log(`✓ Saved to ${CHROME_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} extensions)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Chrome Web Store Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - Total users: ${(result.metadata.stats.totalUsers / 1000000).toFixed(1)}M`);
    console.log('\n✅ Chrome extension fetch from CWS Database completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

