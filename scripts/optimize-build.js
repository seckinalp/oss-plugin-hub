#!/usr/bin/env node

/**
 * Build optimization script for OSS Plugin Hub
 * This script helps optimize the build process by:
 * 1. Pre-warming the data cache
 * 2. Validating data integrity
 * 3. Providing build statistics
 */

import { getAllPluginData, getCacheStats, clearDataCache, getSupportedPlatforms } from './data-cache.js';
import fs from 'fs';
import path from 'path';

async function preWarmCache() {
  console.log('🔥 Pre-warming data cache...');
  
  try {
    const startTime = Date.now();
    const pluginData = getAllPluginData();
    const endTime = Date.now();
    
    if (pluginData) {
      console.log(`✅ Cache warmed successfully`);
      console.log(`📊 Loaded ${pluginData.plugins.length} plugins`);
      console.log(`⏱️  Cache warm time: ${endTime - startTime}ms`);
      console.log(`📅 Last updated: ${pluginData.lastUpdated}`);
      
      // Show cache stats
      const stats = getCacheStats();
      console.log(`💾 Cache stats: ${stats.dataCacheSize} data entries, ${stats.fileStatsCacheSize} file stats`);
      
      return true;
    } else {
      console.log('❌ Failed to load plugin data');
      return false;
    }
  } catch (error) {
    console.error('❌ Error pre-warming cache:', error);
    return false;
  }
}

async function validateDataIntegrity() {
  console.log('\n🔍 Validating data integrity...');
  
  try {
    const pluginData = getAllPluginData();
    if (!pluginData) {
      console.log('❌ No plugin data available');
      return false;
    }
    
    const platforms = getSupportedPlatforms();
    const platformCounts = {};
    
    // Count plugins per platform
    pluginData.plugins.forEach(plugin => {
      platformCounts[plugin.platform] = (platformCounts[plugin.platform] || 0) + 1;
    });
    
    console.log('📈 Platform distribution:');
    platforms.forEach(platform => {
      const count = platformCounts[platform] || 0;
      console.log(`  ${platform}: ${count} plugins`);
    });
    
    // Check for duplicate IDs
    const ids = pluginData.plugins.map(p => p.id);
    const uniqueIds = new Set(ids);
    
    if (ids.length !== uniqueIds.size) {
      console.log(`⚠️  Warning: Found ${ids.length - uniqueIds.size} duplicate plugin IDs`);
    } else {
      console.log('✅ No duplicate plugin IDs found');
    }
    
    // Check for plugins with GitHub stats
    const withStats = pluginData.plugins.filter(p => p.githubStats).length;
    console.log(`📊 Plugins with GitHub stats: ${withStats}/${pluginData.plugins.length} (${((withStats / pluginData.plugins.length) * 100).toFixed(1)}%)`);
    
    return true;
  } catch (error) {
    console.error('❌ Error validating data:', error);
    return false;
  }
}

async function generateBuildReport() {
  console.log('\n📋 Generating build report...');
  
  try {
    const pluginData = getAllPluginData();
    if (!pluginData) {
      return false;
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      totalPlugins: pluginData.plugins.length,
      lastUpdated: pluginData.lastUpdated,
      platforms: {},
      cacheStats: getCacheStats(),
    };
    
    // Count by platform
    pluginData.plugins.forEach(plugin => {
      report.platforms[plugin.platform] = (report.platforms[plugin.platform] || 0) + 1;
    });
    
    // Write report to file
    const reportPath = path.join(process.cwd(), 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Build report saved to: ${reportPath}`);
    console.log(`📊 Total plugins: ${report.totalPlugins}`);
    console.log(`💾 Cache entries: ${report.cacheStats.dataCacheSize}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error generating build report:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 OSS Plugin Hub Build Optimizer');
  console.log('================================\n');
  
  const startTime = Date.now();
  
  // Clear any existing cache
  clearDataCache();
  
  // Pre-warm cache
  const cacheSuccess = await preWarmCache();
  if (!cacheSuccess) {
    process.exit(1);
  }
  
  // Validate data
  const validationSuccess = await validateDataIntegrity();
  if (!validationSuccess) {
    console.log('⚠️  Data validation failed, but continuing...');
  }
  
  // Generate report
  await generateBuildReport();
  
  const endTime = Date.now();
  console.log(`\n✅ Build optimization completed in ${endTime - startTime}ms`);
  console.log('\n💡 Tips for faster builds:');
  console.log('  - Use "npm run build:fast" to skip linting');
  console.log('  - Use "npm run build:analyze" to analyze bundle size');
  console.log('  - Consider using incremental builds for development');
}

// Run the main function
main().catch(console.error);

export { preWarmCache, validateDataIntegrity, generateBuildReport };
