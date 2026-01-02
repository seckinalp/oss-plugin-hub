# GitHub Analytics

Comprehensive analysis of all GitHub repositories across all plugin platforms.

## Generate Analytics

```bash
npm run generate-github-analytics
```

This analyzes all `data/{platform}/top100.json` files and generates `data/github-analytics.json`.

## Generated File: `data/github-analytics.json`

### Overview

The analytics file contains comprehensive data about all 900 plugins across 9 platforms, including:

- Repository statistics and metrics
- Language and license distributions
- Duplicate repository tracking
- Platform-specific breakdowns
- Top repositories by various metrics

### File Structure

```json
{
  "generatedAt": "2025-12-17T17:33:51.921Z",
  "summary": { /* Overall statistics */ },
  "platforms": { /* Per-platform stats */ },
  "topRepositories": { /* Top repos by stars, most duplicated */ },
  "languages": { /* Language distribution */ },
  "licenses": { /* License distribution */ },
  "repositories": { /* Detailed data for each unique repo */ }
}
```

## Summary Statistics

Based on the latest run (December 17, 2025):

### Overall Stats

- **Total Plugins**: 900
- **Unique Repositories**: 822
- **Duplicate Repositories**: 35
- **Deduplication Savings**: 78 plugins (8.7%)

### GitHub Metrics

- **Total Stars**: 1,372,852
- **Total Forks**: 216,017
- **Total Open Issues**: 99,757
- **Average Stars per Repo**: 1,670.1
- **Average Forks per Repo**: 262.8
- **Average Open Issues per Repo**: 121.4

### Top Language

**TypeScript** - 251 repositories (30.5%)

Other notable languages:
- JavaScript: 63-100 repos per platform
- Java: Multiple platforms
- Python: Various platforms

### Top License

**MIT License** - 334 repositories (40.6%)

Other common licenses:
- GNU General Public License v3.0
- Apache License 2.0
- Other/Custom licenses

## Platform Breakdown

| Platform | Plugins | Unique Repos | Shared Repos | Total Stars | Avg Stars |
|----------|---------|--------------|--------------|-------------|-----------|
| **Chrome** | 100 | 95 | 25 | 754,096 | 7,937.9 |
| **Firefox** | 100 | 99 | - | 57,029 | - |
| **Home Assistant** | 100 | 100 | - | 71,025 | - |
| **JetBrains** | 100 | 67 | - | 125,281 | - |
| **Minecraft** | 100 | 100 | - | 30,385 | - |
| **Obsidian** | 100 | 100 | - | 91,575 | - |
| **Sublime** | 100 | 100 | - | 59,452 | - |
| **VSCode** | 100 | 90 | - | 155,698 | - |
| **WordPress** | 100 | 91 | - | 28,311 | - |

### Platform Insights

**Chrome Extensions** have the highest star count (754K), indicating high popularity and visibility.

**JetBrains** has only 67 unique repos for 100 plugins, showing significant repository sharing (multiple plugins from same monorepos).

**Home Assistant, Minecraft, Obsidian, and Sublime** have perfect 100 unique repos, indicating minimal sharing.

## Top Repositories

### By Stars (Top 10)

The analytics includes the top 50 repositories by stars. Examples include:
- `gorhill/uBlock` - Ad blocker
- `AdguardTeam/AdguardBrowserExtension` - Ad blocker
- `MetaMask/metamask-extension` - Crypto wallet
- And more...

### Most Duplicated (Cross-Platform)

The analytics tracks repositories that appear in multiple platforms:

**Most duplicated:**
- `JetBrains/intellij-community` - 19 plugins
- `JetBrains/intellij-plugins` - 14 plugins
- `WordPress/performance` - 9 plugins
- `Microsoft/vscode-remote-release` - 6 plugins
- Cross-browser extensions (Privacy Badger, Vimium, etc.)

## Per-Platform Details

Each platform section includes:

```json
{
  "totalPlugins": 100,
  "withGithubRepo": 100,
  "withoutRepo": 0,
  "uniqueRepos": 95,
  "sharedRepos": 25,
  "totalStars": 754096,
  "totalForks": 117364,
  "totalOpenIssues": 30845,
  "averageStars": 7937.9,
  "topLanguages": [
    { "language": "JavaScript", "count": 63 },
    { "language": "TypeScript", "count": 25 }
  ],
  "topLicenses": [
    { "license": "GNU General Public License v3.0", "count": 28 },
    { "license": "MIT License", "count": 24 }
  ]
}
```

## Repository Details

For each unique repository, the analytics includes:

```json
{
  "pluginCount": 1,
  "platforms": [
    {
      "platform": "chrome",
      "pluginName": "uBlock Origin",
      "pluginId": "cjpalhdlnbpafiamejdnhcphjbkeiagm"
    }
  ],
  "githubStats": {
    "stars": 45000,
    "forks": 3000,
    "openIssues": 50,
    "watchers": 45000,
    "language": "JavaScript",
    "license": "GNU General Public License v3.0",
    "topics": ["ad-blocker", "chrome-extension"],
    "size": 12345,
    "createdAt": "2014-06-24T00:00:00Z",
    "lastUpdated": "2025-12-15T00:00:00Z",
    "defaultBranch": "master",
    "archived": false,
    "disabled": false
  },
  "isDuplicate": false
}
```

## Use Cases

### 1. Security Analysis

Combine with OpenSSF Scorecard data:

```javascript
const analytics = require('./data/github-analytics.json');
const scorecard = require('./data/openssf-scorecard-cache.json');

// Find repos with low security scores
for (const [repo, data] of Object.entries(analytics.repositories)) {
  const score = scorecard[repo];
  if (score && score.score < 5) {
    console.log(`Low security: ${repo} - Score: ${score.score}`);
  }
}
```

### 2. Language Analysis

```javascript
const analytics = require('./data/github-analytics.json');

// See language distribution
console.log(analytics.languages.summary);

// Per platform
console.log(analytics.platforms.obsidian.topLanguages);
```

### 3. License Compliance

```javascript
const analytics = require('./data/github-analytics.json');

// Find all GPL-licensed plugins
for (const [repo, data] of Object.entries(analytics.repositories)) {
  if (data.githubStats?.license?.includes('GPL')) {
    console.log(repo, data.platforms);
  }
}
```

### 4. Cross-Platform Analysis

```javascript
const analytics = require('./data/github-analytics.json');

// Find repos used in multiple platforms
const crossPlatform = analytics.topRepositories.mostDuplicated;
console.log('Cross-platform repos:', crossPlatform.length);
```

### 5. Popularity Metrics

```javascript
const analytics = require('./data/github-analytics.json');

// Top repos by stars
const topStars = analytics.topRepositories.byStars.slice(0, 10);
console.log('Top 10 by stars:', topStars);
```

## Regeneration

The analytics should be regenerated whenever:

- New plugins are added to top100.json files
- GitHub stats are updated
- You want fresh statistics

Simply run:

```bash
npm run generate-github-analytics
```

The process takes ~5-10 seconds and processes all 900 plugins automatically.

## Integration

The analytics file can be:

1. **Used in your web app** - Display stats, charts, filters
2. **Combined with other data** - SBOM, OpenSSF Scorecard, OSV scans
3. **Analyzed programmatically** - Node.js scripts, Python analysis
4. **Visualized** - Create dashboards, charts, reports
5. **Monitored** - Track changes over time

## File Size

- **Size**: ~450 KB
- **Repositories**: 822 entries with full details
- **Depth**: Up to 10 levels of nesting
- **Format**: Pretty-printed JSON for readability

## Notes

- All GitHub stats are from the latest `top100.json` updates
- Statistics only include repos with valid GitHub URLs
- Duplicate counting is based on normalized repo URLs (owner/repo format)
- Platform stats may differ from overall stats due to deduplication
- Archived and disabled repos are flagged in the data

## Related Scripts

- `generate-analytics-summary.js` - Original analytics (different format)
- `update-github-stats.js` - Fetch fresh GitHub data
- `fetch-openssf-scorecard.js` - Security scores
- `fetch-sbom.js` - Software Bill of Materials














