# Incremental GitHub Stats Fetching Guide

## Overview

This system implements an incremental fetching strategy to work around GitHub API rate limits. Instead of fetching data for all plugins at once, it:

1. **Fetches data incrementally** - Updates only a subset of plugins per run (default: 50)
2. **Prioritizes intelligently** - Updates new plugins and outdated plugins first
3. **Tracks freshness** - Records when each plugin's GitHub data was last fetched
4. **Runs automatically** - Vercel cron job runs every 2 hours
5. **Stops when complete** - Once all plugins are up to date, it skips updates until new plugins arrive or data becomes stale

## How It Works

### 1. Data Freshness Tracking

Each plugin now includes a `githubDataFetchedAt` timestamp:

```typescript
interface BasePlugin {
  id: string;
  name: string;
  // ... other fields
  github?: GitHubStats;
  githubDataFetchedAt?: string; // ISO timestamp
}
```

### 2. Intelligent Prioritization

The system prioritizes plugins in this order:

1. **Never fetched** - Plugins with no `githubDataFetchedAt`
2. **Outdated** - Plugins where `githubDataFetchedAt` is older than `MAX_AGE_DAYS` (default: 7 days)
3. **Up to date** - Plugins fetched within the last 7 days (skipped)

### 3. Rate Limit Management

- **Default limit**: 50 plugins per run
- **Configurable via CLI**: `--limit=N`
- **Automatic rate limit checking**: Verifies sufficient API quota before starting
- **Delay between requests**: 100ms to avoid hitting rate limits
- **Estimated API calls**: ~10 calls per plugin

### 4. Automated Execution

**Vercel Cron Job** (configured in `vercel.json`):
- **Path**: `/api/cron/update-github-stats`
- **Schedule**: Every 2 hours (`0 */2 * * *`)
- **Protected by**: `CRON_SECRET` environment variable

## Usage

### Manual Execution

Run the incremental update script locally:

```bash
# Default: Update up to 50 plugins older than 7 days
npm run update-github-incremental

# Custom limit
node scripts/incremental-github-update.js --limit=100

# Custom max age
node scripts/incremental-github-update.js --max-age-days=3

# Both
node scripts/incremental-github-update.js --limit=100 --max-age-days=3
```

### Automated Execution (Vercel)

The cron job runs automatically every 2 hours. To trigger it manually:

```bash
# Using curl (replace with your domain)
curl -X GET https://your-domain.vercel.app/api/cron/update-github-stats \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Full Update (Legacy)

To update all plugins at once (may hit rate limits):

```bash
npm run update-github-stats
```

## Configuration

### Environment Variables

**Required for production:**
- `GH_TOKEN` - GitHub Personal Access Token (increases rate limit from 60 to 5,000/hour)
- `CRON_SECRET` - Secret token to protect the cron endpoint

**How to set up:**

1. **GitHub Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with `public_repo` scope
   - Add to Vercel: Settings → Environment Variables → `GH_TOKEN`

2. **Cron Secret**:
   - Generate a random secret: `openssl rand -hex 32`
   - Add to Vercel: Settings → Environment Variables → `CRON_SECRET`

### Adjusting Update Frequency

Edit `vercel.json` to change the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-github-stats",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

**Common schedules:**
- Every hour: `"0 * * * *"`
- Every 4 hours: `"0 */4 * * *"`
- Every 6 hours: `"0 */6 * * *"`
- Daily at midnight: `"0 0 * * *"`

### Adjusting Limits

In `scripts/incremental-github-update.js` or `app/api/cron/update-github-stats/route.ts`:

```javascript
const PLUGINS_PER_RUN = 50;     // Number of plugins to update per run
const MAX_AGE_DAYS = 7;          // Days before data is considered stale
const DELAY_MS = 100;            // Milliseconds between API calls
```

## Rate Limit Estimates

### With GitHub Token (5,000 requests/hour)

- **Plugins per run**: 50
- **API calls per plugin**: ~10
- **Total calls per run**: ~500
- **Runs per hour**: ~10 possible
- **Plugins per hour**: ~500
- **Time to update 2,000 plugins**: ~4 hours

### Without Token (60 requests/hour)

- **Plugins per run**: 5 (recommended)
- **API calls per plugin**: ~10
- **Total calls per run**: ~50
- **Runs per hour**: 1 possible
- **Plugins per hour**: ~5
- **Time to update 2,000 plugins**: ~400 hours (~17 days)

**💡 Recommendation**: Always use a GitHub token in production!

## Monitoring

### Check Update Status

The cron endpoint returns JSON with update stats:

```json
{
  "success": true,
  "message": "Incremental update completed",
  "stats": {
    "total": 2000,
    "updated": 50,
    "failed": 0,
    "processed": 50,
    "remaining": 150
  },
  "rateLimit": {
    "limit": 5000,
    "remaining": 4500,
    "reset": 1234567890,
    "used": 500
  }
}
```

### Check Logs

**Vercel Dashboard**:
1. Go to your project
2. Click "Deployments"
3. Select latest deployment
4. Click "Functions" tab
5. View logs for `/api/cron/update-github-stats`

**Local testing**:
```bash
npm run update-github-incremental
```

## Workflow

### Initial Setup (All Plugins Need Data)

1. **Day 1**: Cron runs, fetches 50 plugins (newest)
2. **Day 1 (+2h)**: Cron runs, fetches next 50 plugins
3. **Day 1 (+4h)**: Cron runs, fetches next 50 plugins
4. **...continues every 2 hours**
5. **~2-3 days**: All plugins have GitHub data

### Steady State (All Plugins Have Data)

1. **Days 1-7**: No updates needed (all data fresh)
2. **Day 8**: 50 oldest plugins are now 8 days old → cron updates them
3. **Day 8 (+2h)**: Next 50 oldest plugins updated
4. **...continues cycling through plugins**

### When New Plugins Are Added

1. New plugins have no `githubDataFetchedAt`
2. Next cron run prioritizes new plugins first
3. New plugins get data immediately
4. Old plugins continue their update cycle

## Troubleshooting

### "All plugins are up to date" but some plugins missing data

**Cause**: Plugins might have failed to fetch but were marked with `githubDataFetchedAt`

**Solution**: Manually clear the timestamp for specific plugins:
```javascript
// In data/plugins.json, find the plugin and remove:
"githubDataFetchedAt": "2024-01-01T00:00:00.000Z"
```

### Rate limit exceeded

**Cause**: Too many plugins per run or no GitHub token

**Solutions**:
1. Add `GH_TOKEN` environment variable
2. Reduce `PLUGINS_PER_RUN` in the script
3. Increase cron interval (e.g., every 4 hours instead of 2)

### Cron job not running

**Possible causes**:
1. Not deployed to Vercel (crons only work in production)
2. Invalid cron schedule syntax
3. Missing `CRON_SECRET` environment variable

**Solutions**:
1. Deploy to Vercel: `vercel --prod`
2. Check `vercel.json` cron syntax
3. Add `CRON_SECRET` in Vercel dashboard

### Some plugins take very long to update

**Cause**: Some GitHub repositories are very large or have many contributors

**Solution**: The delay between requests (`DELAY_MS`) prevents this from blocking other plugins. They'll be processed in subsequent runs.

## Migration Guide

### Migrating Existing Data

If you have existing plugins without `githubDataFetchedAt`:

1. **Option A**: Let the system handle it
   - New plugins will be fetched automatically on next cron run
   - No manual intervention needed

2. **Option B**: Manually run the incremental script
   ```bash
   npm run update-github-incremental -- --limit=100
   ```

3. **Option C**: Backfill timestamps for existing data
   ```javascript
   // One-time script
   const data = require('./data/plugins.json');
   const now = new Date().toISOString();
   
   data.plugins.forEach(plugin => {
     if (plugin.github && !plugin.githubDataFetchedAt) {
       plugin.githubDataFetchedAt = now;
     }
   });
   
   fs.writeFileSync('./data/plugins.json', JSON.stringify(data, null, 2));
   ```

## API Reference

### GET `/api/cron/update-github-stats`

**Headers**:
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  stats?: {
    total: number;        // Total plugins
    updated: number;      // Successfully updated this run
    failed: number;       // Failed to fetch
    processed: number;    // Total processed this run
    remaining: number;    // Still need updating
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  };
  error?: string;
}
```

## Best Practices

1. **Always use a GitHub token** in production
2. **Monitor rate limits** regularly via Vercel logs
3. **Adjust limits based on your plugin count**:
   - < 500 plugins: 50/run, every 2 hours
   - 500-1000 plugins: 50/run, every hour
   - 1000-2000 plugins: 100/run, every hour
   - > 2000 plugins: 100/run, every 30 minutes
4. **Set up alerts** for cron job failures (Vercel Monitoring)
5. **Keep backups** of `data/plugins.json` before major updates

## FAQ

**Q: How long until all my plugins have GitHub data?**
A: With default settings (50 plugins/run, every 2 hours) and a GitHub token:
- 500 plugins: ~1 day
- 1000 plugins: ~2 days
- 2000 plugins: ~4 days

**Q: Will this work without a GitHub token?**
A: Yes, but very slowly. Expect 5 plugins/run max.

**Q: Can I run this locally?**
A: Yes! Use `npm run update-github-incremental`

**Q: What happens if the cron job fails?**
A: Next run will pick up where it left off. No data is lost.

**Q: Can I force a full refresh?**
A: Yes, either:
1. Delete all `githubDataFetchedAt` timestamps
2. Run `npm run update-github-stats` (old script, may hit limits)
3. Set `--max-age-days=0` to force refresh all

## Support

For issues or questions:
1. Check Vercel logs for cron job execution
2. Run locally to test: `npm run update-github-incremental`
3. Verify GitHub token has correct permissions
4. Check rate limit status manually in the script output

