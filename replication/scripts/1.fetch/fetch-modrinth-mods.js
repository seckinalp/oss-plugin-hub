const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const MODRINTH_API_BASE = 'api.modrinth.com';
const DATA_DIR = path.join(__dirname, '../data');
const MINECRAFT_DIR = path.join(DATA_DIR, 'minecraft');
const PLUGINS_FILE = path.join(MINECRAFT_DIR, 'plugins.json');
const METADATA_FILE = path.join(MINECRAFT_DIR, 'metadata.json');
const TEMP_FILE = path.join(MINECRAFT_DIR, 'temp-projects.json'); // Temporary file for progress

// Fetch settings - configurable
const MAX_PAGES = parseInt(process.env.MODRINTH_MAX_PAGES) || 2200; // Increased default to fetch more
const PAGE_SIZE = Math.min(parseInt(process.env.MODRINTH_PAGE_SIZE) || 100, 100); // Modrinth API max is 100
const GITHUB_ONLY = process.env.MODRINTH_GITHUB_ONLY !== 'false'; // Default: only fetch mods with GitHub repos
const BATCH_DELAY = parseInt(process.env.MODRINTH_BATCH_DELAY) || 0; // Delay between batches in ms
const RETRY_DELAY = parseInt(process.env.MODRINTH_RETRY_DELAY) || 1000; // Delay after rate limit in ms
const MAX_RETRIES = parseInt(process.env.MODRINTH_MAX_RETRIES) || 3; // Max retries for failed requests

// Project types to fetch from Modrinth and URL prefixes
const PROJECT_TYPES = [
  { type: 'mod', contentType: 'mod', urlPrefix: 'mod' },
  { type: 'resourcepack', contentType: 'resourcepack', urlPrefix: 'resourcepack' },
  { type: 'datapack', contentType: 'datapack', urlPrefix: 'datapack' },
  { type: 'shader', contentType: 'shader', urlPrefix: 'shader' },
  { type: 'modpack', contentType: 'modpack', urlPrefix: 'modpack' },
];

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MINECRAFT_DIR)) {
  fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
}

/**
 * Fetch projects from Modrinth API by type
 * Uses the v2 API endpoints
 */
function fetchModrinthProjects(projectType, offset = 0, limit = 100) {
  return new Promise((resolve, reject) => {
    const searchParams = new URLSearchParams({
      query: '',
      offset: offset.toString(),
      limit: limit.toString(),
      facets: JSON.stringify([
        [`project_type:${projectType}`]
      ]),
      index: 'relevance' // Sort by relevance
    });

    const options = {
      hostname: MODRINTH_API_BASE,
      path: `/v2/search?${searchParams}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0 (Minecraft Modrinth Fetcher)',
        'Accept': 'application/json'
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

    req.end();
  });
}

/**
 * Fetch detailed project information from Modrinth
 */
function fetchModrinthProject(projectId, retries = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: MODRINTH_API_BASE,
      path: `/v2/project/${projectId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0 (Minecraft Modrinth Fetcher)',
        'Accept': 'application/json'
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
        } else if (res.statusCode === 429 && retries < MAX_RETRIES) {
          // Rate limited - retry after delay
          console.log(`   ⚠️  Rate limited for ${projectId}, retrying in ${RETRY_DELAY/1000}s... (attempt ${retries + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            fetchModrinthProject(projectId, retries + 1).then(resolve).catch(reject);
          }, RETRY_DELAY);
        } else if (res.statusCode === 403) {
          // Forbidden - API is blocking us, stop gracefully
          console.log(`   🛑 API Forbidden (403) for ${projectId} - stopping gracefully`);
          reject(new Error(`API_FORBIDDEN: HTTP 403 - API access denied`));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      if (retries < MAX_RETRIES) {
        console.log(`   ⚠️  Network error for ${projectId}, retrying in ${RETRY_DELAY/1000}s... (attempt ${retries + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          fetchModrinthProject(projectId, retries + 1).then(resolve).catch(reject);
        }, RETRY_DELAY);
      } else {
        reject(error);
      }
    });

    req.end();
  });
}

/**
 * Parse Modrinth project to our plugin format
 */
function parseModrinthProject(project, contentType, urlPrefix, detailedProject = null) {
  // Use detailed project data if available, otherwise use search result data
  const projectData = detailedProject || project;
  
  // Extract GitHub repository from source URL
  let repo = null;
  if (projectData.source_url) {
    const match = projectData.source_url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      repo = match[1].replace(/\.git$/, '');
    }
  }

  // Determine mod type and loader (only for mods)
  let modType = undefined;
  let loader = undefined;
  
  if (contentType === 'mod') {
    loader = 'fabric';
    if (projectData.categories) {
      if (projectData.categories.includes('forge')) {
        loader = 'forge';
      } else if (projectData.categories.includes('quilt')) {
        loader = 'quilt';
      }
      
      // Check if it's server-side compatible
      if (projectData.server_side === 'required' || projectData.server_side === 'optional') {
        modType = projectData.client_side === 'required' ? 'both' : 'server';
      } else {
        modType = 'client';
      }
    }
  }

  // Extract Minecraft versions from versions array
  const minecraftVersions = projectData.versions || [];

  return {
    id: projectData.project_id || projectData.id,
    name: projectData.title,
    author: projectData.author || 'Unknown',
    description: projectData.description || '',
    repo: repo,
    platform: 'minecraft',
    contentType: contentType,
    modType: modType,
    loader: loader,
    minecraftVersions: minecraftVersions,
    downloadCount: projectData.downloads || 0,
    rating: 0, // Modrinth doesn't have ratings
    ratingCount: 0,
    categories: projectData.categories || [],
    tags: projectData.keywords || [],
    source: 'modrinth',
    sourceId: projectData.project_id || projectData.id,
    downloadUrl: `https://modrinth.com/${urlPrefix}/${projectData.slug}`,
    projectUrl: `https://modrinth.com/${urlPrefix}/${projectData.slug}`,
    publishedDate: projectData.published || projectData.date_created,
    lastUpdated: projectData.updated || projectData.date_modified
  };
}

/**
 * Fetch all projects for a specific type
 */
async function fetchAllForType(projectType, contentType, urlPrefix, maxPages = 1000, pageSize = 100) {
  const allProjects = [];
  
  console.log(`📥 Fetching ${contentType}s (up to ${maxPages} pages, ${pageSize} per page)...`);
  
  for (let page = 0; page < maxPages; page++) {
    try {
      const offset = page * pageSize;
      console.log(`   Fetching page ${page + 1}/${maxPages} (offset: ${offset})...`);
      
      const result = await fetchModrinthProjects(projectType, offset, pageSize);
      
      if (result.hits && result.hits.length > 0) {
        allProjects.push(...result.hits);
        console.log(`   ✓ Fetched ${result.hits.length} ${contentType}s`);
        
        // If we got fewer results than requested, we've reached the end
        if (result.hits.length < pageSize) {
          console.log(`   No more ${contentType}s found (got ${result.hits.length} < ${pageSize})`);
          break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log(`   No more ${contentType}s found (empty result)`);
        break;
      }
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page + 1}:`, error.message);
      break;
    }
  }
  
  return allProjects;
}

/**
 * Save temporary projects data
 */
function saveTempProjects(allProjects) {
  const tempData = {
    projects: allProjects,
    timestamp: new Date().toISOString(),
    totalCount: allProjects.length
  };
  fs.writeFileSync(TEMP_FILE, JSON.stringify(tempData, null, 2));
  console.log(`💾 Saved ${allProjects.length} projects to temp file for GitHub processing...`);
}

/**
 * Load temporary projects data
 */
function loadTempProjects() {
  if (fs.existsSync(TEMP_FILE)) {
    try {
      const tempData = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
      console.log(`📂 Loaded ${tempData.totalCount} projects from temp file (saved: ${tempData.timestamp})`);
      return tempData.projects;
    } catch (error) {
      console.warn(`⚠️  Failed to load temp file: ${error.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Save temporary parsed plugins data
 */
function saveTempParsedPlugins(parsedPlugins, processedCount) {
  const tempData = {
    parsedPlugins: parsedPlugins,
    timestamp: new Date().toISOString(),
    processedCount: processedCount,
    totalCount: parsedPlugins.length
  };
  fs.writeFileSync(TEMP_FILE, JSON.stringify(tempData, null, 2));
  console.log(`💾 Saved ${parsedPlugins.length} parsed plugins to temp file (processed ${processedCount} items)...`);
}

/**
 * Load temporary parsed plugins data
 */
function loadTempParsedPlugins() {
  if (fs.existsSync(TEMP_FILE)) {
    try {
      const tempData = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
      if (tempData.parsedPlugins && tempData.processedCount !== undefined) {
        console.log(`📂 Loaded ${tempData.totalCount} parsed plugins from temp file (processed ${tempData.processedCount}, saved: ${tempData.timestamp})`);
        return tempData;
      }
      return null;
    } catch (error) {
      console.warn(`⚠️  Failed to load temp file: ${error.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Clean up temporary file
 */
function cleanupTempFile() {
  if (fs.existsSync(TEMP_FILE)) {
    fs.unlinkSync(TEMP_FILE);
    console.log('🧹 Cleaned up temporary file');
  }
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(minecraftPlugins) {
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
  const mergedPlugins = minecraftPlugins.map(plugin => {
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
  
  // Deduplicate by GitHub repo: keep one entry per unique GitHub repository
  const deduplicatedPlugins = [];
  const repoMap = new Map();
  
  for (const plugin of mergedPlugins) {
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
        // Keep the one with more data (GitHub stats, etc.)
        if (plugin.githubStats && !existing.githubStats) {
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
  
  const finalPlugins = deduplicatedPlugins.length > 0 ? deduplicatedPlugins : mergedPlugins;
  
  // Create metadata
  const pluginsWithStats = finalPlugins.filter(p => p.githubStats);
  const pluginsWithRepos = finalPlugins.filter(p => p.repo);
  
  // Calculate stats by mod type and loader
  const modTypes = { client: 0, server: 0, both: 0 };
  const loaders = { fabric: 0, forge: 0, quilt: 0, spigot: 0, paper: 0, bukkit: 0 };
  const sources = { modrinth: 0, curseforge: 0, spiget: 0 };
  
  finalPlugins.forEach(plugin => {
    if (plugin.modType) modTypes[plugin.modType]++;
    if (plugin.loader) loaders[plugin.loader]++;
    if (plugin.source) sources[plugin.source]++;
  });
  
  const metadata = {
    platform: 'minecraft',
    totalCount: finalPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalDownloads: finalPlugins.reduce((sum, p) => sum + (p.downloadCount || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: finalPlugins.filter(p => p.rating).length > 0
        ? finalPlugins.filter(p => p.rating).reduce((sum, p) => sum + p.rating, 0) / finalPlugins.filter(p => p.rating).length
        : 0,
      modTypes: modTypes,
      loaders: loaders,
      sources: sources
    }
  };
  
  // Save files
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: finalPlugins }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  return { plugins: finalPlugins, metadata };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Modrinth ALL types fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Max pages: ${MAX_PAGES} (per type)`);
  console.log(`   - Page size: ${PAGE_SIZE}`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to projects with GitHub repos' : 'will include all projects'})`);
  console.log(`   - Batch delay: ${BATCH_DELAY}ms between batches`);
  console.log(`   - Retry delay: ${RETRY_DELAY}ms after rate limits`);
  console.log(`   - Max retries: ${MAX_RETRIES} per request`);
  console.log(`   - Set MODRINTH_MAX_PAGES env var to limit pages (default: 2200)`);
  console.log(`   - Set MODRINTH_GITHUB_ONLY=false to include projects without GitHub repos`);
  console.log(`   - Set MODRINTH_BATCH_DELAY=5000 to increase delay between batches`);
  console.log(`   - Set MODRINTH_RETRY_DELAY=15000 to increase delay after rate limits\n`);
  
  try {
    let allProjects = [];
    
    // Check if we have partial parsed progress first
    const tempParsedData = loadTempParsedPlugins();
    let allParsedPlugins = [];
    let startIndex = 0;
    
    if (tempParsedData) {
      console.log('📂 Found partial parsed progress, will resume from where we left off...\n');
      allParsedPlugins = tempParsedData.parsedPlugins;
      startIndex = tempParsedData.processedCount;
      
      // We still need to load the raw projects to have the full list
      const tempProjects = loadTempProjects();
      if (tempProjects) {
        allProjects = tempProjects;
      } else {
        throw new Error('Found parsed progress but no raw projects data. Please start from Phase 1.');
      }
    } else {
      // Check if we have temp data from previous run
      const tempProjects = loadTempProjects();
      if (tempProjects) {
        console.log('📂 Found previous fetch data, skipping project collection phase...\n');
        allProjects = tempProjects;
      } else {
        console.log('🔄 Phase 1: Fetching all project types...\n');
        
        // Fetch all project types
        for (const projectType of PROJECT_TYPES) {
          console.log(`📂 Fetching type: ${projectType.type}`);
          const projects = await fetchAllForType(projectType.type, projectType.contentType, projectType.urlPrefix, MAX_PAGES, PAGE_SIZE);
          console.log(`   ✓ ${projectType.type}: collected ${projects.length}`);
          allProjects.push(...projects);
        }
        
        console.log(`\n✓ Phase 1 Complete: Fetched ${allProjects.length} total Modrinth projects\n`);
        
        // Save temp data for GitHub processing phase
        saveTempProjects(allProjects);
      }
      
      // Phase 2: Parse and process GitHub repos
      console.log('🔄 Phase 2: Processing GitHub repositories...\n');
      
      // Parse to our format
      console.log('🔄 Parsing projects...');
      
      // First, parse with basic data
      const basicParsedPlugins = [];
      for (const projectType of PROJECT_TYPES) {
        const typeProjects = allProjects.filter(p => p.project_type === projectType.type);
        const parsed = typeProjects.map(project => parseModrinthProject(project, projectType.contentType, projectType.urlPrefix));
        basicParsedPlugins.push(...parsed);
      }
      
      allParsedPlugins = basicParsedPlugins;
    }
    
    // For GitHub-only mode, we need to fetch detailed project info to get source URLs
    if (GITHUB_ONLY) {
      console.log('🔍 Fetching detailed project information to find GitHub repos...');
      console.log(`   Starting from index ${startIndex} of ${allParsedPlugins.length}...`);
      
      const detailedPlugins = allParsedPlugins.slice(0, startIndex); // Keep already processed plugins
      
      // Process in batches to avoid overwhelming the API
      const batchSize = 3; // Further reduced batch size to avoid rate limits
      for (let i = startIndex; i < allParsedPlugins.length; i += batchSize) {
        const batch = allParsedPlugins.slice(i, i + batchSize);
        console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allParsedPlugins.length / batchSize)}...`);
        
        const batchPromises = batch.map(async (plugin) => {
          try {
            const detailedProject = await fetchModrinthProject(plugin.sourceId);
            return parseModrinthProject(plugin, plugin.contentType, plugin.contentType === 'mod' ? 'mod' : plugin.contentType, detailedProject);
          } catch (error) {
            if (error.message.includes('API_FORBIDDEN')) {
              // 403 error - API is blocking us, throw to stop the entire process
              throw error;
            }
            console.warn(`   ⚠️  Failed to fetch details for ${plugin.name}: ${error.message}`);
            return plugin; // Return basic data if detailed fetch fails
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        detailedPlugins.push(...batchResults);
        
        // Save progress after every 1000 items
        if ((i + batchSize) % 1000 === 0 || i + batchSize >= allParsedPlugins.length) {
          saveTempParsedPlugins(detailedPlugins, i + batchSize);
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY)); // Configurable delay to avoid rate limits
      }
      
      allParsedPlugins = detailedPlugins;
    }
    
    // Filter based on GitHub-only setting
    let minecraftPlugins;
    if (GITHUB_ONLY) {
      minecraftPlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} projects`);
      console.log(`   - With GitHub repos: ${minecraftPlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - minecraftPlugins.length} (filtered out)\n`);
    } else {
      minecraftPlugins = allParsedPlugins;
      const withRepos = minecraftPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${minecraftPlugins.length} projects`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${minecraftPlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by downloads
    console.log('📊 Top 10 Modrinth projects by downloads:');
    const sorted = [...minecraftPlugins].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 10);
    sorted.forEach((project, i) => {
      const downloads = (project.downloadCount / 1000000).toFixed(1) + 'M';
      const loaderInfo = project.loader ? `, ${project.loader}` : '';
      console.log(`   ${i + 1}. ${project.name} by ${project.author} (${downloads} downloads, ${project.contentType}${loaderInfo})`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(minecraftPlugins);
    
    console.log(`✓ Saved to ${MINECRAFT_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} projects)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Minecraft Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total downloads: ${(result.metadata.stats.totalDownloads / 1000000).toFixed(1)}M`);
    console.log(`   - Mod types: Client: ${result.metadata.stats.modTypes.client}, Server: ${result.metadata.stats.modTypes.server}, Both: ${result.metadata.stats.modTypes.both}`);
    console.log(`   - Loaders: Fabric: ${result.metadata.stats.loaders.fabric}, Forge: ${result.metadata.stats.loaders.forge}, Quilt: ${result.metadata.stats.loaders.quilt}`);
    // Clean up temp file
    cleanupTempFile();
    
    console.log('\n✅ Modrinth ALL types fetch completed successfully!');
    
  } catch (error) {
    if (error.message.includes('API_FORBIDDEN')) {
      console.error('\n🛑 API Access Denied (403 Forbidden)');
      console.error('The Modrinth API is blocking requests. This could be due to:');
      console.error('- Too many requests in a short time');
      console.error('- IP address being temporarily blocked');
      console.error('- API key issues (if using one)');
      console.error('\n💡 Suggestions:');
      console.error('- Wait 1-2 hours before trying again');
      console.error('- Use the temp file to resume: npm run fetch-minecraft-modrinth');
      console.error('- Reduce batch size: MODRINTH_BATCH_DELAY=10000 npm run fetch-minecraft-modrinth');
    } else {
      console.error('\n❌ Error fetching Modrinth projects:', error.message);
      console.error(error.stack);
    }
    console.log('\n💡 Tip: You can resume from where it left off by running the script again (it will use the temp file)');
    process.exit(1);
  }
}

// Run the script
main();
