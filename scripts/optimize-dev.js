#!/usr/bin/env node

/**
 * Development optimization script
 * This script helps speed up development by:
 * 1. Creating a lightweight data subset for development
 * 2. Enabling hot reload optimizations
 * 3. Providing development statistics
 */

import fs from 'fs';
import path from 'path';
import { getAllPluginData, getSupportedPlatforms } from './data-cache.js';

async function createDevDataSubset() {
  console.log('🔧 Creating development data subset...');
  
  try {
    const pluginData = getAllPluginData();
    if (!pluginData) {
      console.log('❌ No plugin data available');
      return false;
    }
    
    // Create a subset with only the first 100 plugins from each platform for faster dev builds
    const platforms = getSupportedPlatforms();
    const devPlugins = [];
    
    platforms.forEach(platform => {
      const platformPlugins = pluginData.plugins.filter(p => p.platform === platform).slice(0, 100);
      devPlugins.push(...platformPlugins);
    });
    
    const devData = {
      plugins: devPlugins,
      lastUpdated: pluginData.lastUpdated,
      isDevSubset: true,
      totalPlugins: pluginData.plugins.length,
      devPluginsCount: devPlugins.length,
    };
    
    // Write dev data to a separate file
    const devDataPath = path.join(process.cwd(), 'data', 'dev-plugins.json');
    fs.writeFileSync(devDataPath, JSON.stringify(devData, null, 2));
    
    console.log(`✅ Dev subset created: ${devPlugins.length} plugins`);
    console.log(`📄 Saved to: ${devDataPath}`);
    console.log(`📊 Reduction: ${((1 - devPlugins.length / pluginData.plugins.length) * 100).toFixed(1)}%`);
    
    return true;
  } catch (error) {
    console.error('❌ Error creating dev subset:', error);
    return false;
  }
}

async function enableDevOptimizations() {
  console.log('⚡ Enabling development optimizations...');
  
  try {
    // Create a .env.local file with dev optimizations
    const envContent = `# Development optimizations
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_REDUCED_DATA=true

# Performance optimizations
NEXT_TELEMETRY_DISABLED=1
`;
    
    const envPath = path.join(process.cwd(), '.env.local');
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Development optimizations enabled');
    console.log('📄 Created .env.local with dev settings');
    
    return true;
  } catch (error) {
    console.error('❌ Error enabling dev optimizations:', error);
    return false;
  }
}

async function generateDevReport() {
  console.log('📋 Generating development report...');
  
  try {
    const pluginData = getAllPluginData();
    if (!pluginData) {
      return false;
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'development',
      totalPlugins: pluginData.plugins.length,
      platforms: {},
      recommendations: [
        'Use "npm run dev" for development with full data',
        'Use "npm run dev:fast" for development with reduced data',
        'Consider using "npm run build:optimize" before building',
      ],
    };
    
    // Count by platform
    pluginData.plugins.forEach(plugin => {
      report.platforms[plugin.platform] = (report.platforms[plugin.platform] || 0) + 1;
    });
    
    // Write report to file
    const reportPath = path.join(process.cwd(), 'dev-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Dev report saved to: ${reportPath}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error generating dev report:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 OSS Plugin Hub Development Optimizer');
  console.log('======================================\n');
  
  const startTime = Date.now();
  
  // Create dev data subset
  const subsetSuccess = await createDevDataSubset();
  if (!subsetSuccess) {
    console.log('⚠️  Failed to create dev subset, but continuing...');
  }
  
  // Enable dev optimizations
  const optimizationsSuccess = await enableDevOptimizations();
  if (!optimizationsSuccess) {
    console.log('⚠️  Failed to enable optimizations, but continuing...');
  }
  
  // Generate report
  await generateDevReport();
  
  const endTime = Date.now();
  console.log(`\n✅ Development optimization completed in ${endTime - startTime}ms`);
  console.log('\n💡 Development tips:');
  console.log('  - Use "npm run dev" for full development experience');
  console.log('  - Use "npm run dev:fast" for faster development with reduced data');
  console.log('  - Check dev-report.json for detailed statistics');
  console.log('  - Use browser dev tools to monitor performance');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createDevDataSubset, enableDevOptimizations, generateDevReport };
