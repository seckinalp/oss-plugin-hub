# Repository Duplication Analysis

Focused analysis identifying which repositories host multiple plugins and detecting monorepo patterns.

## Generate Analysis

```bash
npm run analyze-repo-duplicates
```

Output: `data/repo-duplication-analysis.json`

## What This Analyzes

This analysis identifies **3 key repository patterns**:

### 1. 🎯 Dedicated Repositories (787 repos - 95.7%)
- Single repository, single plugin
- Example: `gorhill/uBlock` → uBlock Origin
- **Most common pattern** - one repo per plugin

### 2. 📦 Monorepos (7 repos)
- Single repository hosting multiple **different** plugins for the same platform
- Detected by repository name patterns (`community`, `plugins`, `core`, etc.)
- Plugin names vary significantly

**Top Monorepos:**
- `JetBrains/intellij-community` - **19 plugins!**
  - Python, Kotlin, Lombok, GitHub, YAML, Maven, Markdown, etc.
  - All very different plugins in one massive repo
  
- `JetBrains/intellij-plugins` - **14 plugins**
  - Prettier, Terraform, Dart, Vue.js, Angular, etc.
  - Multiple unrelated plugins
  
- `WordPress/performance` - **9 plugins**
  - Performance Lab, Image formats, Speculative Loading, etc.
  - All performance-related but separate plugins

- `Microsoft/vscode-remote-release` - **6 plugins**
  - WSL, Dev Containers, Remote SSH, Remote Explorer, etc.

### 3. 🔄 Cross-Platform Repositories (20 repos)
- Same repository, different platforms (Chrome + Firefox, etc.)
- Example: `facebook/react` → React DevTools for both Chrome and Firefox
- **Answer to your question**: These are repos where the plugin is NOT dedicated to one platform

**Examples:**
- `facebook/react` - React DevTools for Chrome & Firefox
  - ❌ NOT a dedicated Chrome plugin repo
  - ✅ Main React repo with DevTools in it
  
- `gorhill/uBlock` - uBlock Origin for Chrome & Firefox
- `reduxjs/redux-devtools` - Redux DevTools for Chrome & Firefox
- `GoogleChrome/lighthouse` - Lighthouse for Chrome & Firefox

## Key Insights

### React Example (Answering Your Question)

```json
{
  "repo": "facebook/react",
  "category": "cross-platform",
  "pluginCount": 2,
  "platforms": ["chrome", "firefox"],
  "plugins": [
    {
      "platform": "chrome",
      "pluginName": "React Developer Tools"
    },
    {
      "platform": "firefox",
      "pluginName": "React Developer Tools"
    }
  ],
  "monorepoAnalysis": {
    "isLikelyMonorepo": false,
    "hasMonorepoName": false,
    "pluginNamesVarySignificantly": false
  }
}
```

**Answer**: `facebook/react` is:
- ❌ NOT dedicated to the Chrome extension
- ✅ Main React library repository
- 🔧 Has DevTools **inside** the repo (likely in `/packages/react-devtools-extensions/`)
- 🌐 Builds for both Chrome and Firefox from same source

### JetBrains Community Example

```json
{
  "repo": "JetBrains/intellij-community",
  "category": "monorepo-same-platform",
  "pluginCount": 19,
  "monorepoAnalysis": {
    "isLikelyMonorepo": true,
    "hasMonorepoName": true,
    "pluginNamesVarySignificantly": true
  },
  "pluginNames": [
    "Python Community Edition",
    "Kotlin",
    "Lombok",
    "GitHub",
    "YAML",
    "Maven",
    "Markdown",
    "Terminal",
    // ... 11 more plugins
  ]
}
```

**Pattern**: This is a **true monorepo** with:
- 19 completely different plugins
- All for JetBrains IDE
- Each plugin likely in separate `/plugins/` subdirectories

## File Structure

### Summary Section

```json
{
  "summary": {
    "totalRepositories": 822,
    "dedicated": 787,           // 95.7% - one repo, one plugin
    "multiPluginSamePlatform": 8,  // Related plugins (Beta versions, etc.)
    "monorepoSamePlatform": 7,     // True monorepos
    "crossPlatform": 20            // Cross-platform extensions
  }
}
```

### Categories Section

```json
{
  "categories": {
    "multiPluginSamePlatform": [
      // Repos with multiple related plugins (e.g., Tampermonkey + Tampermonkey Beta)
    ],
    "monorepoSamePlatform": [
      // True monorepos (JetBrains, WordPress, Microsoft)
    ],
    "crossPlatform": [
      // Repos publishing to multiple platforms (React, uBlock, Redux, etc.)
    ]
  }
}
```

### Detailed Analysis Section

```json
{
  "detailedAnalysis": {
    "facebook/react": {
      "repo": "facebook/react",
      "category": "cross-platform",
      "categoryDescription": "Cross-platform repository with plugins for 2 different platforms",
      "pluginCount": 2,
      "platformCount": 2,
      "platforms": ["chrome", "firefox"],
      "plugins": [
        {
          "platform": "chrome",
          "pluginId": "chrome-fmkadmapgofadopljbjfkapdkoienihi",
          "pluginName": "React Developer Tools",
          "author": "facebook",
          "description": "React Developer Tools"
        },
        {
          "platform": "firefox",
          "pluginId": "firefox-react-devtools",
          "pluginName": "React Developer Tools",
          "author": "React",
          "description": "..."
        }
      ],
      "githubStats": {
        "stars": 240888,
        "forks": 49942,
        "language": "JavaScript",
        "topics": ["react", "library", "ui", "frontend"]
      },
      "monorepoAnalysis": {
        "isLikelyMonorepo": false,
        "hasMonorepoName": false,
        "pluginNamesVarySignificantly": false
      }
    }
  }
}
```

## Detection Logic

### Monorepo Detection

Identifies monorepos by:

1. **Repository name patterns**:
   - `community`, `plugins`, `extensions`, `packages`
   - `monorepo`, `workspace`, `suite`, `toolkit`
   - `platform`, `core`, `framework`

2. **Plugin name variation**:
   - If plugin names are very different (Python, Kotlin, YAML)
   - Indicates separate projects in one repo

3. **Plugin count**:
   - More than 3 plugins with varying names → likely monorepo

### Cross-Platform Detection

Identifies when:
- Same repo serves multiple platforms
- Example: Chrome + Firefox versions

## Use Cases

### 1. Identify Monorepo Plugins

```javascript
const analysis = require('./data/repo-duplication-analysis.json');

// Find all monorepos
const monorepos = analysis.categories.monorepoSamePlatform;
console.log(`Found ${monorepos.length} monorepos`);

monorepos.forEach(repo => {
  console.log(`${repo.repo}: ${repo.pluginCount} plugins`);
});
```

### 2. Find Cross-Platform Extensions

```javascript
const crossPlatform = analysis.categories.crossPlatform;

// Extensions available on multiple platforms
crossPlatform.forEach(repo => {
  console.log(`${repo.repo}:`);
  repo.platforms.forEach(p => console.log(`  - ${p}`));
});
```

### 3. Check If Plugin is Dedicated

```javascript
const repoToCheck = 'facebook/react';
const repoData = analysis.detailedAnalysis[repoToCheck];

if (repoData.category === 'dedicated') {
  console.log('This is a dedicated plugin repository');
} else {
  console.log(`This is a ${repoData.category} repository`);
  console.log(`Hosts ${repoData.pluginCount} plugins`);
}
```

### 4. Analyze Repository Structure

```javascript
// Find repos that might need special handling
Object.entries(analysis.detailedAnalysis).forEach(([repo, data]) => {
  if (data.category === 'monorepo-same-platform') {
    console.log(`Monorepo: ${repo}`);
    console.log(`  Plugins: ${data.plugins.map(p => p.pluginName).join(', ')}`);
  }
});
```

## Statistics

From latest analysis (822 unique repos):

| Category | Count | Percentage | Description |
|----------|-------|------------|-------------|
| **Dedicated** | 787 | 95.7% | One repo, one plugin |
| **Multi-plugin** | 8 | 1.0% | Related plugins (Beta, etc.) |
| **Monorepo** | 7 | 0.9% | Multiple different plugins |
| **Cross-platform** | 20 | 2.4% | Same plugin, multiple platforms |

### Takeaways

✅ **95.7% of plugins have dedicated repositories**
- Most plugin developers create one repo per plugin
- Clean, simple structure

❌ **Only 7 true monorepos** (0.9%)
- Mostly JetBrains (2 repos, 33 plugins!)
- Microsoft VSCode (2 repos, 10 plugins)
- WordPress Performance (1 repo, 9 plugins)

🌐 **20 cross-platform repos** (2.4%)
- Popular extensions like React DevTools, uBlock Origin
- Same codebase, multiple platforms
- **These answer your question** - not dedicated to one platform

## Important Notes

### About Cross-Platform Repos

When you see `facebook/react`:
- ❌ It's NOT a Chrome extension repo
- ✅ It's the React library repo
- 🔧 DevTools are inside (e.g., `/packages/react-devtools-extensions/`)
- 📦 They build browser extensions from this monorepo
- 🌐 Publish to Chrome Web Store + Firefox Add-ons from same source

### About JetBrains Repos

`JetBrains/intellij-community`:
- 🏢 Main IntelliJ IDEA repository
- 📦 Contains 19 built-in plugins
- 🔧 Each in `/plugins/` subdirectory
- 🎯 All plugins ship with IDE

## Related Files

- `data/repo-duplication-analysis.json` - Full analysis output
- `data/github-analytics.json` - General GitHub statistics
- `scripts/analyze-repo-duplicates.js` - Analysis script

## Regeneration

Run anytime your `top100.json` files are updated:

```bash
npm run analyze-repo-duplicates
```

Takes ~5 seconds to analyze all 900 plugins.














