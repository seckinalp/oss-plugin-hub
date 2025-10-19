# Setup Guide

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/oss-plugin-hub.git
cd oss-plugin-hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# GitHub Personal Access Token
# Required for higher API rate limits (5,000/hour vs 60/hour)
# Create at: https://github.com/settings/tokens
# Required scopes: public_repo
GH_TOKEN=your_github_token_here

# Cron Secret for Vercel (Production only)
# Required to protect the cron endpoint from unauthorized access
# Generate with: openssl rand -hex 32
CRON_SECRET=your_random_secret_here
```

#### Getting a GitHub Token

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Plugin Hub Development")
4. Select scope: `public_repo`
5. Click "Generate token"
6. Copy the token and add it to `.env.local`

**⚠️ Important**: Never commit your `.env.local` file or expose your tokens publicly!

#### Generating a Cron Secret

```bash
# On Linux/Mac
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Fetch Plugin Data

```bash
# Fetch the list of plugins (fast)
npm run fetch-plugins

# Update GitHub statistics incrementally (recommended)
npm run update-github-incremental

# Or update all at once (may hit rate limits)
npm run update-github-stats
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure environment variables:
   - Add `GH_TOKEN` (your GitHub token)
   - Add `CRON_SECRET` (generate a new one for production)

### 3. Deploy

Click "Deploy" and wait for the build to complete.

### 4. Verify Cron Job

After deployment:
1. Go to your Vercel dashboard
2. Select your project
3. Click "Settings" → "Cron Jobs"
4. You should see: `/api/cron/update-github-stats` running every 2 hours

## Available Scripts

### Data Management

```bash
# Fetch the list of plugins from sources
npm run fetch-plugins

# Update GitHub stats for all plugins (may hit rate limits)
npm run update-github-stats

# Incrementally update GitHub stats (recommended)
npm run update-github-incremental

# Fetch plugins and update stats (full)
npm run update-data

# Fetch plugins and update stats (incremental)
npm run update-data-incremental
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Lint code
npm run lint
```

## Incremental GitHub Updates

The incremental update system is designed to work around GitHub API rate limits. See [INCREMENTAL_FETCH_GUIDE.md](./INCREMENTAL_FETCH_GUIDE.md) for detailed documentation.

**Key features:**
- ✅ Updates only 50 plugins per run (configurable)
- ✅ Prioritizes new plugins and outdated data
- ✅ Runs automatically via Vercel cron (every 2 hours)
- ✅ Stops when all plugins are up to date
- ✅ Resumes when new plugins are added

### Manual Run with Custom Settings

```bash
# Update 100 plugins at once
node scripts/incremental-github-update.js --limit=100

# Consider data stale after 3 days instead of 7
node scripts/incremental-github-update.js --max-age-days=3

# Combine both
node scripts/incremental-github-update.js --limit=100 --max-age-days=3
```

## Configuration

### Adjusting Update Frequency

Edit `vercel.json` to change the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-github-stats",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

**Common cron schedules:**
- Every hour: `"0 * * * *"`
- Every 2 hours: `"0 */2 * * *"` (default)
- Every 4 hours: `"0 */4 * * *"`
- Every 6 hours: `"0 */6 * * *"`
- Daily at midnight: `"0 0 * * *"`

### Adjusting Plugins Per Run

Edit `scripts/incremental-github-update.js`:

```javascript
const PLUGINS_PER_RUN = 50;  // Increase or decrease as needed
```

Or use command line arguments:

```bash
node scripts/incremental-github-update.js --limit=100
```

## Troubleshooting

### Rate Limit Issues

**Problem**: Getting rate limit errors

**Solutions**:
1. Make sure `GH_TOKEN` is set in environment variables
2. Reduce `PLUGINS_PER_RUN` in the script
3. Increase time between cron runs in `vercel.json`
4. Use incremental updates: `npm run update-github-incremental`

### Missing GitHub Data

**Problem**: Some plugins don't have GitHub statistics

**Solutions**:
1. Run incremental update: `npm run update-github-incremental`
2. Wait for cron jobs to gradually update all plugins
3. Check Vercel logs for errors

### Cron Job Not Running

**Problem**: Cron job not executing on Vercel

**Solutions**:
1. Verify you're on a Vercel plan that supports cron jobs
2. Check that `CRON_SECRET` is set in Vercel environment variables
3. Check Vercel dashboard → Functions → Logs for errors
4. Test the endpoint manually (see below)

### Testing Cron Endpoint Locally

```bash
# Start the dev server
npm run dev

# In another terminal, test the endpoint
curl -X GET http://localhost:3000/api/cron/update-github-stats \
  -H "Authorization: Bearer your_cron_secret"
```

## Monitoring

### Check Update Status

View the status of GitHub data updates:

```bash
# Run incremental update with output
npm run update-github-incremental
```

Sample output:
```
📊 Analysis:
   Never fetched: 50
   Outdated: 100
   Up to date: 1850
   To update: 50

✓ Plugin Name (123 ⭐)
...

📊 Summary:
   ✅ Updated: 50
   ❌ Failed: 0
   📈 Remaining to update: 100
```

### Check Vercel Logs

1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments" → Latest deployment
4. Click "Functions" tab
5. View logs for `/api/cron/update-github-stats`

## Best Practices

1. **Always use a GitHub token** - Essential for production
2. **Start with incremental updates** - Avoid rate limit issues
3. **Monitor rate limits** - Check Vercel logs regularly
4. **Keep backups** - Backup `data/plugins.json` before major updates
5. **Test locally first** - Run scripts locally before deploying
6. **Use environment variables** - Never hardcode tokens

## Next Steps

- Read [INCREMENTAL_FETCH_GUIDE.md](./INCREMENTAL_FETCH_GUIDE.md) for detailed information on the incremental update system
- Check [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines
- See [CHANGELOG.md](./CHANGELOG.md) for version history

## Getting Help

If you encounter issues:

1. Check this guide and [INCREMENTAL_FETCH_GUIDE.md](./INCREMENTAL_FETCH_GUIDE.md)
2. Search existing [GitHub Issues](https://github.com/yourusername/oss-plugin-hub/issues)
3. Create a new issue with:
   - Description of the problem
   - Steps to reproduce
   - Error messages or logs
   - Your environment (Node version, OS, etc.)

## Security

- **Never commit `.env.local`** - It's in `.gitignore` by default
- **Rotate tokens regularly** - Generate new tokens every few months
- **Use different tokens for dev/prod** - Separate tokens for different environments
- **Limit token scopes** - Only grant necessary permissions (`public_repo`)
- **Monitor token usage** - Check GitHub token usage in Settings → Developer Settings

## License

MIT - See [LICENSE](./LICENSE) for details

