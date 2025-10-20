# Scripts Documentation

## Overview

This directory contains scripts for fetching and updating plugin data from GitHub.

## Scripts

### 1. `fetch-plugins.js` - Fetch Plugin List

Fetches the list of Obsidian plugins from the official repository.

```bash
npm run fetch-plugins
```

**What it does:**
- Downloads the latest community plugins list from Obsidian's official GitHub
- Saves to `data/plugins.json`
- Tracks new plugins since last run
- Shows summary of changes

**No API token required** - downloads a single JSON file

---

### 2. `update-github-stats.js` - Fetch Comprehensive GitHub Stats

Fetches detailed GitHub statistics for each plugin. **This is a comprehensive, standalone script.**

#### **Incremental Mode (Default)**
Only fetches stats for plugins that don't have them yet:
```bash
npm run update-stats
```

#### **Force Re-fetch Mode**
Re-fetches stats for ALL plugins, even if they already have data:
```bash
npm run update-stats:force
# OR
npm run update-stats -- --force
# OR  
node scripts/update-github-stats.js --force
```

**What it fetches for EACH plugin:**

#### Basic Stats
- ⭐ Stars, forks, watchers
- 📝 Open/closed issues and PRs
- 📅 Last updated date, creation date
- 📄 License, language, topics
- 📦 Repository size
- 🗃️ Archive status

#### Documentation
- 📖 **README content** (full markdown)

#### Releases & Versions
- 🏷️ Latest version
- 📋 Release count
- 📅 Release dates
- 📝 Release notes

#### Contributors
- 👥 Total contributor count
- 🌟 Top 5 contributors with stats

#### Activity & Health
- 📊 Commit activity (total, frequency, recent)
- 💚 Health metrics (issue close rate, maintenance score)
- 🔄 Code frequency (additions/deletions over time)
- 📈 Participation (owner vs community commits)

#### Code & Project Structure
- 💻 Language distribution
- 📦 Dependencies from package.json
- 🏗️ Build scripts
- ⚙️ CI/CD workflows (GitHub Actions)

#### Governance & Community
- 📜 CONTRIBUTING.md
- 🤝 CODE_OF_CONDUCT.md  
- 🔒 SECURITY.md
- ⚖️ LICENSE file
- 🏥 Community health score
- 💰 Funding links (GitHub Sponsors, Patreon, Ko-fi, etc.)

#### Recent Activity
- 📝 Last 10 commits
- 🏷️ Git tags
- ⭐ Recent stargazers (trending data)

**Output includes:**
- Real-time progress updates
- API call tracking
- Rate limit monitoring
- Comprehensive final statistics
- Time taken
- Aggregate plugin stats (total stars, forks, etc.)

---

### 3. `fetch-all` - Complete Update

Runs both scripts in sequence:

```bash
npm run fetch-all
```

Equivalent to:
```bash
npm run fetch-plugins && npm run update-stats
```

---

## GitHub API Token

### Why You Need It

The `update-github-stats.js` script makes **~21 API requests per plugin**:

- **Without token**: 60 requests/hour → ~2-3 plugins per hour
- **With token**: 5000 requests/hour → ~240 plugins per hour

### How to Get a Token

1. Go to https://github.com/settings/tokens/new
2. Give it a name (e.g., "OSS Plugin Hub")
3. Select expiration (recommend: 90 days or no expiration)
4. **No scopes needed** for public repositories
5. Click "Generate token"
6. Copy the token (you won't see it again!)

### How to Use the Token

#### Windows PowerShell

**Temporary (current session only):**
```powershell
$env:GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

**Permanent (add to PowerShell profile):**
```powershell
# Edit profile
notepad $PROFILE

# Add this line:
$env:GH_TOKEN="ghp_your_token_here"
```

#### Windows Command Prompt

```cmd
set GH_TOKEN=ghp_your_token_here
npm run update-stats
```

#### Linux/Mac

**Temporary:**
```bash
export GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

**Permanent (add to ~/.bashrc or ~/.zshrc):**
```bash
echo 'export GH_TOKEN="ghp_your_token_here"' >> ~/.bashrc
source ~/.bashrc
```

#### Using .env file (recommended)

Create a `.env` file in the project root:

```bash
GH_TOKEN=ghp_your_token_here
GITHUB_TOKEN=ghp_your_token_here  # Alternative name
```

**Note:** `.env` should be in `.gitignore` - never commit your token!

---

## Script Output Examples

### update-github-stats.js Output

#### Incremental Mode (Default)

```
╔══════════════════════════════════════════════════════════╗
║          🚀 GITHUB STATS UPDATE SCRIPT                  ║
╚══════════════════════════════════════════════════════════╝

🎯 Mode: INCREMENTAL (will only fetch new plugins without stats)
   Use --force or -f flag to re-fetch all plugins

📡 Checking GitHub API status...

📊 GitHub API Rate Limit:
   Used: 245 / 5000
   Remaining: 4755

✓ GitHub token found. Rate limit: 5000 requests/hour

════════════════════════════════════════════════════════════
📦 Total plugins: 1847
   Already have stats: 1800
   Need to fetch: 47
⏱️  Estimated API calls: ~940
⏱️  Estimated time: ~2 minutes
════════════════════════════════════════════════════════════

[1/1847] (0%) Advanced Tables
   Repo: tgrosinger/advanced-tables-obsidian
   ⏭️  Skipping - already has stats (use --force to re-fetch)

[2/1847] (0%) New Plugin
   Repo: tgrosinger/advanced-tables-obsidian
   📊 Fetching comprehensive data...
   ✅ Success!
      ⭐ 2431 stars | 🔀 143 forks | 📝 89 open issues
      📅 Last updated: 10/15/2024
      🏷️  Version: 0.21.1

[2/1847] (0%) Calendar
   Repo: liamcain/obsidian-calendar-plugin
   📊 Fetching comprehensive data...
   ✅ Success!
      ⭐ 1856 stars | 🔀 89 forks | 📝 45 open issues
      📅 Last updated: 9/28/2024
      🏷️  Version: 1.5.10

...

────────────────────────────────────────────────────────────
Progress: 10/1847 plugins processed
API Calls so far: 203
────────────────────────────────────────────────────────────

...


╔══════════════════════════════════════════════════════════╗
║                  📋 FINAL SUMMARY                        ║
╠══════════════════════════════════════════════════════════╣
║  Plugins Updated:      47                                ║
║  Already Had Stats:    1800                              ║
║  Skipped (No Repo):    0                                 ║
║  Failed:               0                                 ║
║  ──────────────────────────────────────────────────────  ║
║  Total Stars:          245,678                           ║
║  Total Forks:          32,456                            ║
║  Active Plugins:       1820                              ║
║  Archived Plugins:     15                                ║
║  ──────────────────────────────────────────────────────  ║
║  Time Taken:           3642.45s                          ║
║  Data Saved To:        plugins.json                      ║
╚══════════════════════════════════════════════════════════╝

============================================================
📊 API CALL STATISTICS
============================================================
Total API Calls:      36943
Successful:           36789 (99%)
Failed:               154
  Not Found (404):    142
============================================================

📡 Final rate limit check...

📊 GitHub API Rate Limit:
   Used: 37188 / 5000
   Remaining: 2812

✅ All done! You can now commit and push the updated plugins.json
```

---

## Workflow

### 🎬 Initial Setup (First Time)

1. **Fetch the plugin list:**
   ```bash
   npm run fetch-plugins
   ```

2. **Fetch GitHub stats for ALL plugins (with token!):**
   ```bash
   $env:GH_TOKEN="your_token"  # Windows PowerShell
   npm run update-stats
   ```
   This will take a while (~1-2 hours for 1800+ plugins with token)

3. **Commit and push:**
   ```bash
   git add data/plugins.json
   git commit -m "Initial plugin data fetch"
   git push
   ```

---

### 🔄 Regular Updates (Adding New Plugins)

When Obsidian releases new plugins, just fetch them:

```bash
npm run fetch-plugins  # Gets new plugins
npm run update-stats   # Only fetches stats for NEW plugins (incremental)
```

This is **much faster** because it skips plugins that already have stats!

---

### 🔁 Full Re-fetch (Updating All Plugins)

To update stats for all plugins (e.g., weekly/monthly):

```bash
npm run fetch-plugins
npm run update-stats:force  # Re-fetches ALL plugins
```

Or combine:
```bash
npm run fetch-plugins && npm run update-stats -- --force
```

---

### 💡 Recommended Schedule

**Daily/Weekly:**
```bash
npm run fetch-all  # Incremental - only new plugins
```

**Monthly:**
```bash
npm run fetch-plugins
npm run update-stats:force  # Full update
```

---

## Troubleshooting

### "Rate limit exceeded"

**Problem:** Too many API requests without a token or token exhausted.

**Solutions:**
1. Add a GitHub token (see above)
2. Wait for rate limit to reset (check reset time in output)
3. If you have a token but still hitting limits, wait ~1 hour

### "plugins.json not found"

**Problem:** You haven't run `fetch-plugins` yet.

**Solution:**
```bash
npm run fetch-plugins
```

### "Could not parse repository URL"

**Problem:** Some plugins have invalid or missing repo URLs.

**Solution:** This is expected - the script will skip these and continue.

### Script is very slow

**Problem:** 
- No GitHub token (60 requests/hour limit)
- Processing many plugins (~20 API calls each)

**Solution:**
- Add a GitHub token (5000 requests/hour)
- Be patient - comprehensive data takes time!

---

## Data Structure

The `plugins.json` file structure:

```json
{
  "plugins": [
    {
      "id": "obsidian-advanced-tables",
      "name": "Advanced Tables",
      "author": "tgrosinger",
      "description": "Improved table navigation...",
      "repo": "tgrosinger/advanced-tables-obsidian",
      "platform": "obsidian",
      "githubStats": {
        "stars": 2431,
        "forks": 143,
        "openIssues": 89,
        "watchers": 2431,
        "lastUpdated": "2024-10-15T12:34:56Z",
        "license": "MIT",
        "language": "TypeScript",
        "topics": ["obsidian", "table", "markdown"],
        "releaseCount": 45,
        "currentVersion": "0.21.1",
        "totalContributors": 23,
        "topContributors": [...],
        "commitActivity": {...},
        "healthMetrics": {...},
        ...
      }
    }
  ],
  "lastUpdated": "2024-10-20T10:30:00Z",
  "lastStatsUpdate": "2024-10-20T12:45:00Z",
  "totalCount": 1847,
  "statsMetadata": {
    "totalPlugins": 1847,
    "pluginsWithStats": 1835,
    "totalStars": 245678,
    "totalForks": 32456,
    "activePlugins": 1820,
    "archivedPlugins": 15,
    "apiCallsMade": 36943
  }
}
```

---

## Tips

1. **Run during off-peak hours** - GitHub API is faster
2. **Use a token** - 83x faster rate limit
3. **Run regularly** - Weekly or monthly updates recommended
4. **Check rate limits** - Script shows remaining requests
5. **Be patient** - ~1800 plugins × 20 calls = ~1 hour with token

---

## Support

If you encounter issues:

1. Check rate limits in the script output
2. Verify your GitHub token is valid
3. Check your internet connection
4. Look at the error messages - they're descriptive

For questions, open an issue on the repository.

