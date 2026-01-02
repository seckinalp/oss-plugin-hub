import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLATFORMS = [
  'obsidian',
  'vscode',
  'minecraft',
  'firefox',
  'wordpress',
  'homeassistant',
  'jetbrains',
  'sublime',
  'chrome',
];

const OBSIDIAN_STATS_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json';

const OFFLINE = process.argv.includes('--offline');
const PLATFORM_ARG =
  process.argv.find((arg) => arg.startsWith('--platform='))?.split('=')[1] ||
  (process.argv.includes('--platform') ? process.argv[process.argv.indexOf('--platform') + 1] : null);
const TARGET_PLATFORMS = PLATFORM_ARG ? [PLATFORM_ARG] : PLATFORMS;

function resolveDataDir() {
  const candidates = [
    path.join(__dirname, '..', '..', 'data'),
    path.join(__dirname, '..', 'data'),
    path.join(process.cwd(), 'replication', 'data'),
    path.join(process.cwd(), 'data'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, '..', '..', 'data');
}

const DATA_DIR = resolveDataDir();
const PLATFORM_ROOT = fs.existsSync(path.join(DATA_DIR, 'platforms'))
  ? path.join(DATA_DIR, 'platforms')
  : DATA_DIR;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error(`Failed to parse JSON: ${error.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function loadObsidianDownloadMap() {
  if (OFFLINE) {
    return new Map();
  }
  const stats = await fetchJSON(OBSIDIAN_STATS_URL);
  const downloadMap = new Map();
  for (const [pluginId, data] of Object.entries(stats)) {
    downloadMap.set(pluginId, {
      downloads: data.downloads || 0,
      updatedDate: data.updated || null,
    });
  }
  return downloadMap;
}

function ensurePlatformPrefix(platform, id) {
  if (!id || !platform) return id;
  const prefix = `${platform.toLowerCase()}-`;
  const lower = id.toLowerCase();
  if (lower.startsWith(prefix)) return id;
  return `${platform}-${id}`;
}

function getDownloadValue(plugin, platform, downloadMap) {
  if (downloadMap && downloadMap.has(plugin.id)) {
    const entry = downloadMap.get(plugin.id);
    return { downloads: entry.downloads || 0, updatedAt: entry.updatedDate || null };
  }

  let downloads = plugin.downloads;

  if (!Number.isFinite(downloads) || downloads <= 0) {
    switch (platform) {
      case 'vscode':
        downloads = plugin.installs || 0;
        break;
      case 'minecraft':
        downloads = plugin.downloadCount || 0;
        break;
      case 'firefox':
        downloads = plugin.users || plugin.averageDailyUsers || plugin.weeklyDownloads || 0;
        break;
      case 'wordpress':
        downloads = plugin.activeInstalls || 0;
        break;
      case 'chrome':
        downloads = plugin.users || 0;
        break;
      case 'jetbrains':
        downloads = plugin.downloads || 0;
        break;
      case 'sublime':
        downloads = plugin.downloads || 0;
        if (!downloads && plugin.githubStats?.stars) {
          downloads = plugin.githubStats.stars;
        }
        break;
      case 'homeassistant':
        downloads = plugin.downloads || 0;
        if (!downloads && plugin.githubStats?.stars) {
          downloads = plugin.githubStats.stars;
        }
        break;
      default:
        downloads = plugin.downloads || 0;
        break;
    }
  }

  return { downloads: downloads || 0, updatedAt: plugin.downloadStatsUpdated || null };
}

function resolvePlatformInputDir(platform) {
  const directDir = path.join(DATA_DIR, platform);
  const platformsDir = path.join(DATA_DIR, 'platforms', platform);
  if (fs.existsSync(path.join(directDir, 'plugins.json'))) return directDir;
  if (fs.existsSync(path.join(platformsDir, 'plugins.json'))) return platformsDir;
  if (fs.existsSync(directDir)) return directDir;
  if (fs.existsSync(platformsDir)) return platformsDir;
  return null;
}

function loadPlugins(platform) {
  const inputDir = resolvePlatformInputDir(platform);
  if (!inputDir) {
    return { plugins: [], inputDir: null, metadataPath: null };
  }
  const pluginsPath = path.join(inputDir, 'plugins.json');
  if (!fs.existsSync(pluginsPath)) {
    return { plugins: [], inputDir, metadataPath: path.join(inputDir, 'metadata.json') };
  }
  const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
  return { plugins: data.plugins || [], inputDir, metadataPath: path.join(inputDir, 'metadata.json') };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function processPlatform(platform, downloadMap) {
  const { plugins, inputDir, metadataPath } = loadPlugins(platform);
  if (!inputDir || plugins.length === 0) {
    console.log(`??  ${platform}: plugins.json not found or empty`);
    return null;
  }

  const updatedAt = new Date().toISOString();
  const enrichedPlugins = plugins.map((plugin) => {
    const { downloads, updatedAt: statsUpdated } = getDownloadValue(plugin, platform, downloadMap);
    const merged = {
      ...plugin,
      downloads: downloads || 0,
    };
    if (!merged.downloadStatsUpdated && statsUpdated) {
      merged.downloadStatsUpdated = statsUpdated;
    }
    if (!merged.downloadStatsUpdated && merged.downloads > 0) {
      merged.downloadStatsUpdated = updatedAt;
    }
    return merged;
  });

  const topCandidates = enrichedPlugins
    .filter((p) => Number.isFinite(p.downloads) && p.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads);

  const top100 = topCandidates.slice(0, 100).map((plugin) => ({
    ...plugin,
    id: ensurePlatformPrefix(platform, plugin.id),
    platform: plugin.platform || platform,
    isTop100: true,
  }));

  const topIdSet = new Set(top100.map((entry) => entry.id));
  const pluginsWithFlag = enrichedPlugins.map((plugin) => {
    const prefixed = ensurePlatformPrefix(platform, plugin.id);
    return {
      ...plugin,
      isTop100: topIdSet.has(prefixed),
    };
  });

  const outputDir = path.join(PLATFORM_ROOT, platform);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  writeJson(path.join(inputDir, 'plugins.json'), { plugins: pluginsWithFlag });

  writeJson(path.join(outputDir, 'top100.json'), {
    platform,
    generatedAt: updatedAt,
    totalPlugins: plugins.length,
    top100,
  });

  if (metadataPath && fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metadata.top100Count = top100.length;
    metadata.pluginsWithDownloads = pluginsWithFlag.filter((p) => p.downloads > 0).length;
    metadata.totalDownloads = pluginsWithFlag.reduce((sum, p) => sum + (p.downloads || 0), 0);
    metadata.lastDownloadStatsUpdate = updatedAt;
    writeJson(metadataPath, metadata);
  }

  console.log(`? ${platform}: top100.json updated (${top100.length} entries)`);
  return {
    platform,
    total: plugins.length,
    top100: top100.length,
    withDownloads: pluginsWithFlag.filter((p) => p.downloads > 0).length,
  };
}

async function main() {
  console.log('?? Generating top100.json from fetched plugin data\n');
  console.log(`?? Data root: ${DATA_DIR}`);
  console.log(`?? Platforms: ${TARGET_PLATFORMS.join(', ')}\n`);
  if (OFFLINE) {
    console.log('?? Offline mode enabled (skipping remote download stats)\n');
  }

  const obsidianMap = TARGET_PLATFORMS.includes('obsidian') ? await loadObsidianDownloadMap() : new Map();

  for (const platform of TARGET_PLATFORMS) {
    const downloadMap = platform === 'obsidian' ? obsidianMap : null;
    await processPlatform(platform, downloadMap);
  }

  console.log('\n? Done.');
}

main().catch((error) => {
  console.error('\n? Fatal error:', error.message);
  process.exit(1);
});
