# Quick Start Guide - Incremental GitHub Fetching

## 🚀 What Changed?

Your app now fetches GitHub data **incrementally** instead of all at once, solving the rate limit problem!

## ⚡ Quick Setup (5 minutes)

### 1. Get a GitHub Token

```bash
# 1. Visit: https://github.com/settings/tokens
# 2. Click "Generate new token (classic)"
# 3. Name it: "Plugin Hub"
# 4. Select scope: "public_repo"
# 5. Copy the token
```

### 2. Add Environment Variables

Create `.env.local` file:

```env
GH_TOKEN=your_github_token_here
CRON_SECRET=your_random_secret_here
```

Generate a cron secret:
```bash
openssl rand -hex 32
```

### 3. Test Locally

```bash
# Fetch plugin list
npm run fetch-plugins

# Update 10 plugins (test)
npm run update-github-incremental -- --limit=10

# View the results
cat data/plugins.json | grep "githubDataFetchedAt" | head -5
```

## 🔄 How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Vercel Cron (Every 2 Hours)                           │
│  └─> /api/cron/update-github-stats                     │
│      └─> Updates 50 plugins that need it               │
│          └─> Repeats until all plugins are current     │
└─────────────────────────────────────────────────────────┘

Day 1:  50 plugins updated  →  50 total
Hour 2: 50 more updated     →  100 total
Hour 4: 50 more updated     →  150 total
...
After ~3 days: All 2000 plugins have GitHub data ✅
```

## 📦 Deploy to Vercel

```bash
# 1. Push your code
git add .
git commit -m "Add incremental GitHub fetching"
git push

# 2. In Vercel Dashboard:
#    Settings → Environment Variables
#    Add: GH_TOKEN
#    Add: CRON_SECRET

# 3. Deploy
vercel --prod
```

## ✅ Verify It's Working

### Check Locally
```bash
npm run update-github-incremental
```

Look for:
```
✅ Updated: 50
📈 Remaining to update: 150
```

### Check on Vercel

1. Go to Vercel Dashboard
2. Your Project → Settings → Cron Jobs
3. Should see: `/api/cron/update-github-stats` - Every 2 hours

### Test the Endpoint

```bash
curl https://your-app.vercel.app/api/cron/update-github-stats \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Should return:
```json
{
  "success": true,
  "stats": {
    "updated": 50,
    "remaining": 100
  }
}
```

## 🎛️ Configuration

### Update More Plugins Per Run

Edit `scripts/incremental-github-update.js`:
```javascript
const PLUGINS_PER_RUN = 100;  // Change from 50 to 100
```

### Update More Frequently

Edit `vercel.json`:
```json
"schedule": "0 * * * *"  // Every hour instead of every 2 hours
```

### Run with Custom Settings

```bash
# Update 100 plugins
npm run update-github-incremental -- --limit=100

# Update if older than 3 days (instead of 7)
npm run update-github-incremental -- --max-age-days=3
```

## 📊 Monitor Progress

### View Status
```bash
# See how many plugins need updates
npm run update-github-incremental
```

### Check Vercel Logs
```
Vercel Dashboard 
  → Deployments 
  → Latest 
  → Functions 
  → /api/cron/update-github-stats
```

## 🐛 Troubleshooting

### "Rate limit exceeded"
**Fix**: Make sure `GH_TOKEN` is set
```bash
# Check if set
echo $GH_TOKEN
```

### "All plugins up to date" but some missing data
**Fix**: Some failed initially. Clear their timestamp and retry:
```bash
# Find plugin in data/plugins.json and remove:
"githubDataFetchedAt": "2024-..."
```

### Cron not running
**Fix**: Check `CRON_SECRET` is set in Vercel
```
Vercel → Settings → Environment Variables
```

## 📖 Full Documentation

- **INCREMENTAL_FETCH_GUIDE.md** - Complete guide
- **SETUP.md** - Detailed setup instructions
- **IMPLEMENTATION_SUMMARY.md** - Technical details

## 💡 Pro Tips

1. **Start small**: Test with `--limit=10` first
2. **Check rate limit**: Script shows remaining API calls
3. **Be patient**: With 2000 plugins, it takes ~3 days initially
4. **Monitor logs**: First few cron runs on Vercel
5. **Keep backups**: Backup `data/plugins.json` before big changes

## 🎯 Common Commands

```bash
# Test incremental update (10 plugins)
npm run update-github-incremental -- --limit=10

# Full incremental update (50 plugins)
npm run update-github-incremental

# Fetch new plugins + incremental update
npm run update-data-incremental

# Check rate limit status
node scripts/incremental-github-update.js --limit=0
```

## ✨ What You Get

- ✅ No more rate limit errors
- ✅ All plugins get GitHub data
- ✅ Automatic updates every 7 days
- ✅ New plugins updated immediately
- ✅ Scales to thousands of plugins
- ✅ Set it and forget it!

## 🆘 Need Help?

1. Check [INCREMENTAL_FETCH_GUIDE.md](./INCREMENTAL_FETCH_GUIDE.md)
2. Run with verbose output: `npm run update-github-incremental`
3. Check Vercel logs
4. Open a GitHub issue

---

**Quick Reference Card**

```bash
# Setup
npm install
# Add .env.local with GH_TOKEN and CRON_SECRET

# Test
npm run update-github-incremental -- --limit=10

# Deploy
vercel --prod

# Monitor
# Check Vercel Dashboard → Cron Jobs
```

That's it! 🎉

