/**
 * Vercel Cron Job API Route
 * 
 * This route is triggered by Vercel Cron to incrementally update GitHub stats
 * for a subset of plugins on a regular schedule.
 * 
 * Security: Protected by Vercel's cron secret verification
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkRateLimit, fetchRepoStats, parseRepo } from '@/utils/github';
import type { BasePlugin } from '@/types/plugin';

const PLUGINS_PER_RUN = 200; // Update up to 150 plugins per run
const MAX_AGE_DAYS = 7; // Re-fetch if data is older than 7 days
const DELAY_MS = 50; // Delay between API calls

interface PluginData {
  plugins: BasePlugin[];
  lastUpdated: string;
  totalCount?: number;
}

/**
 * Get plugins that need updating
 */
function getPluginsToUpdate(plugins: BasePlugin[], maxAgeDays: number, limit: number) {
  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  const neverFetched: BasePlugin[] = [];
  const outdated: { plugin: BasePlugin; age: number }[] = [];

  for (const plugin of plugins) {
    if (!plugin.repo) continue;

    if (!plugin.githubDataFetchedAt) {
      neverFetched.push(plugin);
    } else {
      const fetchedAt = new Date(plugin.githubDataFetchedAt);
      const age = now.getTime() - fetchedAt.getTime();

      if (age > maxAgeMs) {
        outdated.push({ plugin, age });
      }
    }
  }

  // Sort outdated by age (oldest first)
  outdated.sort((a, b) => b.age - a.age);

  // Combine: never fetched first, then outdated
  const toUpdate = [
    ...neverFetched,
    ...outdated.map(item => item.plugin)
  ].slice(0, limit);

  return {
    toUpdate,
    neverFetchedCount: neverFetched.length,
    outdatedCount: outdated.length
  };
}

/**
 * Delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Starting incremental GitHub stats update via cron...');

    // Check rate limit first
    const rateLimit = await checkRateLimit();
    if (rateLimit && rateLimit.remaining < 100) {
      console.log('⚠️  Rate limit too low, skipping update');
      return NextResponse.json({
        success: false,
        message: 'Rate limit too low',
        rateLimit
      });
    }

    // Load plugins data
    const dataPath = path.join(process.cwd(), 'data', 'plugins.json');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data: PluginData = JSON.parse(fileContent);

    console.log(`📥 Loaded ${data.plugins.length} plugins`);

    // Determine which plugins to update
    const updateInfo = getPluginsToUpdate(data.plugins, MAX_AGE_DAYS, PLUGINS_PER_RUN);
    
    console.log(`📋 Analysis:`);
    console.log(`   Never fetched: ${updateInfo.neverFetchedCount}`);
    console.log(`   Outdated: ${updateInfo.outdatedCount}`);
    console.log(`   To update: ${updateInfo.toUpdate.length}`);

    if (updateInfo.toUpdate.length === 0) {
      console.log('✅ All plugins are up to date!');
      return NextResponse.json({
        success: true,
        message: 'All plugins are up to date',
        stats: {
          total: data.plugins.length,
          updated: 0,
          neverFetched: updateInfo.neverFetchedCount,
          outdated: updateInfo.outdatedCount
        }
      });
    }

    let updated = 0;
    let failed = 0;

    // Update plugins
    for (const plugin of updateInfo.toUpdate) {
      const parsed = parseRepo(plugin.repo);
      if (!parsed) {
        failed++;
        continue;
      }

      try {
        const stats = await fetchRepoStats(parsed.owner, parsed.repo, true);
        if (stats) {
          plugin.github = stats;
          plugin.githubDataFetchedAt = new Date().toISOString();
          updated++;
          console.log(`   ✓ ${plugin.name} (${stats.stars} ⭐)`);
        } else {
          // Mark as attempted even if failed to avoid immediate retry
          plugin.githubDataFetchedAt = new Date().toISOString();
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ Error updating ${plugin.name}:`, error);
        plugin.githubDataFetchedAt = new Date().toISOString();
        failed++;
      }

      // Delay between requests
      await delay(DELAY_MS);
    }

    // Save updated data
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');

    console.log('✅ Update complete!');

    // Check final rate limit
    const finalRateLimit = await checkRateLimit();

    return NextResponse.json({
      success: true,
      message: 'Incremental update completed',
      stats: {
        total: data.plugins.length,
        updated,
        failed,
        processed: updateInfo.toUpdate.length,
        remaining: updateInfo.neverFetchedCount + updateInfo.outdatedCount - updateInfo.toUpdate.length
      },
      rateLimit: finalRateLimit
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

