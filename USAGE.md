# Quick Start Guide

## 🚀 Commands

### Fetch Plugin List
```bash
npm run fetch-plugins
```
Downloads latest Obsidian plugins list from GitHub.

---

### Update GitHub Stats (Smart Mode)
```bash
npm run update-stats
```
**Smart behavior:**
- ✅ Only fetches stats for NEW plugins without data
- ⏭️  Skips plugins that already have stats
- 🚀 Much faster for regular updates!

---

### Update GitHub Stats (Force Re-fetch All)
```bash
npm run update-stats:force
```
**Force mode:**
- 🔄 Re-fetches ALL plugins
- ⚡ Updates existing data
- ⏱️  Takes longer (~1-2 hours for 1800+ plugins)

---

### Fetch Everything
```bash
npm run fetch-all
```
Runs both fetch-plugins and update-stats (incremental mode).

---

## 📋 Typical Workflows

### First Time Setup
```bash
# 1. Get plugins list
npm run fetch-plugins

# 2. Get GitHub stats for all (will take 1-2 hours)
npm run update-stats

# 3. Commit
git add data/plugins.json
git commit -m "Initial data"
git push
```

### Daily/Weekly Updates (Recommended)
```bash
# Just fetch new plugins and their stats
npm run fetch-all

# Commit if there are changes
git add data/plugins.json
git commit -m "Update plugin data"
git push
```

### Monthly Full Refresh
```bash
# Re-fetch everything
npm run fetch-plugins
npm run update-stats:force

# Commit
git add data/plugins.json
git commit -m "Monthly full update"
git push
```

---

## 🔑 GitHub Token (IMPORTANT!)

### Why?
- **Without token**: 60 requests/hour → ~2-3 plugins/hour
- **With token**: 5000 requests/hour → ~240 plugins/hour

### Get Token
1. Go to: https://github.com/settings/tokens/new
2. Name it: "OSS Plugin Hub"
3. No special permissions needed
4. Generate and copy

### Use Token

**Windows PowerShell:**
```powershell
$env:GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

**Permanent (add to profile):**
```powershell
# Edit profile
notepad $PROFILE

# Add:
$env:GH_TOKEN="ghp_your_token_here"
```

**Linux/Mac:**
```bash
export GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

---

## 📊 What Data Gets Fetched?

Each plugin gets:
- ⭐ Stars, forks, watchers
- 📝 Issues, PRs (open/closed)
- 🏷️ Latest version, releases
- 📖 **README content** (full markdown)
- 👥 Contributors
- 📊 Commit activity
- 💚 Health metrics
- 💻 Languages, dependencies
- ⚙️ CI/CD workflows
- 📜 Governance files
- 💰 Funding links
- And more...

---

## ⚡ Key Features

### Incremental Updates (Default)
```bash
npm run update-stats
```
Output:
```
📦 Total plugins: 1847
   Already have stats: 1800
   Need to fetch: 47
⏱️  Estimated time: ~2 minutes
```

### Force Re-fetch
```bash
npm run update-stats:force
```
Output:
```
🔄 Mode: FORCE RE-FETCH (will update all plugins)

📦 Total plugins: 1847
⏱️  Estimated time: ~61 minutes
```

---

## 🆘 Troubleshooting

### "Rate limit exceeded"
→ Add GitHub token (see above)

### "plugins.json not found"
→ Run `npm run fetch-plugins` first

### Script is slow
→ Add GitHub token (83x faster!)

### Some plugins fail
→ Normal! Some repos might be deleted/renamed

---

## 📁 Files

- `data/plugins.json` - All plugin data
- `scripts/fetch-plugins.js` - Fetches plugin list
- `scripts/update-github-stats.js` - Fetches GitHub stats
- `scripts/README.md` - Full documentation

---

## 💡 Pro Tips

1. **Use incremental mode** for daily updates (much faster!)
2. **Use force mode** monthly to refresh all data
3. **Always use a token** (5000 req/hr vs 60 req/hr)
4. **Check rate limits** in script output
5. **Commit regularly** so you don't lose data

---

For detailed documentation, see `scripts/README.md`

