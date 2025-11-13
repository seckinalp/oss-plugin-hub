/**
 * Data cache utility for build scripts (JavaScript version)
 * This is a simplified version that works with Node.js build scripts
 */

import fs from 'fs';
import path from 'path';

// Cache for plugin data to avoid repeated file reads
const dataCache = new Map();
const fileStatsCache = new Map();

// All supported platforms
const SUPPORTED_PLATFORMS = [
  'obsidian',
  'vscode', 
  'firefox',
  'homeassistant',
  'wordpress',
  'jetbrains',
  'sublime',
  'minecraft'
];

/**
 * Get file stats with caching
 */
function getFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const key = filePath;
    const cached = fileStatsCache.get(key);
    
    // Check if file has been modified
    if (cached && cached.mtime === stats.mtime.getTime() && cached.size === stats.size) {
      return cached;
    }
    
    const newStats = {
      mtime: stats.mtime.getTime(),
      size: stats.size,
    };
    
    fileStatsCache.set(key, newStats);
    return newStats;
  } catch (error) {
    return null;
  }
}

/**
 * Load plugin data from a platform directory with caching
 */
export function loadPlatformData(platform) {
  const cacheKey = `platform_${platform}`;
  const dataDir = path.join(process.cwd(), 'data');
  const platformDir = path.join(dataDir, platform);
  const pluginsFile = path.join(platformDir, 'plugins.json');
  const metadataFile = path.join(platformDir, 'metadata.json');
  
  try {
    // Check if files exist
    if (!fs.existsSync(pluginsFile)) {
      return null;
    }
    
    // Get file stats to check for modifications
    const pluginsStats = getFileStats(pluginsFile);
    const metadataStats = fs.existsSync(metadataFile) ? getFileStats(metadataFile) : null;
    
    if (!pluginsStats) {
      return null;
    }
    
    // Check cache
    const cached = dataCache.get(cacheKey);
    if (cached && cached.lastModified >= pluginsStats.mtime) {
      return cached;
    }
    
    // Load fresh data
    const pluginsData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
    const plugins = pluginsData.plugins || [];
    
    let metadata = null;
    if (fs.existsSync(metadataFile)) {
      metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    }
    
    const result = {
      plugins,
      metadata,
      lastModified: pluginsStats.mtime,
    };
    
    // Cache the result
    dataCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error(`Error loading platform data for ${platform}:`, error);
    return null;
  }
}

/**
 * Load all plugin data with optimized caching
 */
export function getAllPluginData() {
  const cacheKey = 'all_plugins';
  const platforms = SUPPORTED_PLATFORMS;
  
  try {
    // Check if we have cached data
    const cached = dataCache.get(cacheKey);
    if (cached) {
      // Verify cache is still valid by checking if any platform data has changed
      let cacheValid = true;
      for (const platform of platforms) {
        const platformData = loadPlatformData(platform);
        if (platformData && platformData.lastModified > (cached.lastUpdated ? new Date(cached.lastUpdated).getTime() : 0)) {
          cacheValid = false;
          break;
        }
      }
      
      if (cacheValid) {
        return cached;
      }
    }
    
    // Load fresh data
    const allPlugins = [];
    let latestUpdate = '';
    
    for (const platform of platforms) {
      const platformData = loadPlatformData(platform);
      if (platformData) {
        allPlugins.push(...platformData.plugins);
        
        if (platformData.metadata?.lastUpdated && platformData.metadata.lastUpdated > latestUpdate) {
          latestUpdate = platformData.metadata.lastUpdated;
        }
      }
    }
    
    if (allPlugins.length === 0) {
      return null;
    }
    
    const result = {
      plugins: allPlugins,
      lastUpdated: latestUpdate || new Date().toISOString(),
    };
    
    // Cache the result
    dataCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error loading all plugin data:', error);
    return null;
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    dataCacheSize: dataCache.size,
    fileStatsCacheSize: fileStatsCache.size,
  };
}

/**
 * Clear the data cache (useful for development)
 */
export function clearDataCache() {
  dataCache.clear();
  fileStatsCache.clear();
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms() {
  return SUPPORTED_PLATFORMS;
}
