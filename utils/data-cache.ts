import fs from 'fs';
import path from 'path';
import { BasePlugin, PluginData } from '@/types/plugin';
import { SUPPORTED_PLATFORMS } from '@/config/platforms';

// Cache for plugin data to avoid repeated file reads
const dataCache = new Map<string, any>();
const fileStatsCache = new Map<string, { mtime: number; size: number }>();

interface CachedPluginData {
  plugins: BasePlugin[];
  metadata: any;
  lastModified: number;
}

/**
 * Get file stats with caching
 */
function getFileStats(filePath: string): { mtime: number; size: number } | null {
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
export function loadPlatformData(platform: string): CachedPluginData | null {
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
    const cached = dataCache.get(cacheKey) as CachedPluginData | undefined;
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
    
    const result: CachedPluginData = {
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
export function getAllPluginData(): PluginData | null {
  const cacheKey = 'all_plugins';
  const platforms = SUPPORTED_PLATFORMS;
  
  try {
    // Check if we have cached data
    const cached = dataCache.get(cacheKey) as PluginData | undefined;
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
    
    // Load fresh data - only Top 100 plugins
    const allPlugins: BasePlugin[] = [];
    let latestUpdate = '';
    
    for (const platform of platforms) {
      const platformData = loadPlatformData(platform);
      if (platformData) {
        // Filter for Top 100 only
        const top100Plugins = platformData.plugins.filter(p => p.isTop100 === true);
        allPlugins.push(...top100Plugins);
        
        if (platformData.metadata?.lastUpdated && platformData.metadata.lastUpdated > latestUpdate) {
          latestUpdate = platformData.metadata.lastUpdated;
        }
      }
    }
    
    if (allPlugins.length === 0) {
      return null;
    }
    
    const result: PluginData = {
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
 * Get a specific plugin by ID with optimized search
 */
export function getPluginById(id: string): BasePlugin | null {
  const platforms = SUPPORTED_PLATFORMS;
  
  for (const platform of platforms) {
    const platformData = loadPlatformData(platform);
    if (platformData) {
      const plugin = platformData.plugins.find((p: BasePlugin) => p.id === id);
      if (plugin) {
        return plugin;
      }
    }
  }
  
  return null;
}

/**
 * Get all plugin IDs for static generation (optimized)
 */
export function getAllPluginIds(): string[] {
  const cacheKey = 'all_plugin_ids';
  const cached = dataCache.get(cacheKey) as string[] | undefined;
  
  if (cached) {
    return cached;
  }
  
  const pluginData = getAllPluginData();
  if (!pluginData) {
    return [];
  }
  
  const ids = pluginData.plugins.map(plugin => plugin.id);
  
  // Cache the IDs
  dataCache.set(cacheKey, ids);
  
  return ids;
}

/**
 * Clear the data cache (useful for development)
 */
export function clearDataCache(): void {
  dataCache.clear();
  fileStatsCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { dataCacheSize: number; fileStatsCacheSize: number } {
  return {
    dataCacheSize: dataCache.size,
    fileStatsCacheSize: fileStatsCache.size,
  };
}
