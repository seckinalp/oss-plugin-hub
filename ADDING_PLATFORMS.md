# Adding New Platforms

This guide explains how to add support for additional plugin platforms (VS Code, JetBrains, Sublime Text, etc.).

## Quick Overview

The app is now designed to support multiple platforms! Here's how to add a new one:

1. Add a fetch script for the platform
2. Update the main fetch script to include it
3. Done! The UI automatically adapts

## Step-by-Step Guide

### 1. Create a Platform-Specific Fetch Script

Create a new script in `scripts/` folder. For example, `scripts/fetch-vscode.js`:

```javascript
const https = require('https');

// VS Code extensions API
const VSCODE_API_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

async function fetchVSCodePlugins() {
  // Implement fetching logic for VS Code marketplace
  // Return array of plugins with this structure:
  return plugins.map(plugin => ({
    id: plugin.id,
    name: plugin.displayName,
    author: plugin.publisher.publisherName,
    description: plugin.shortDescription,
    repo: plugin.repository?.url || '',
    platform: 'vscode', // Important!
  }));
}

module.exports = { fetchVSCodePlugins };
```

### 2. Update Main Fetch Script

Edit `scripts/fetch-plugins.js`:

```javascript
// Import your new fetcher
const { fetchVSCodePlugins } = require('./fetch-vscode');

async function main() {
  // Existing Obsidian fetch
  const obsidianPlugins = await fetchJSON(OBSIDIAN_PLUGINS_URL);
  const plugins = obsidianPlugins.map(plugin => ({
    ...plugin,
    platform: 'obsidian'
  }));

  // Add VS Code plugins
  const vscodePlugins = await fetchVSCodePlugins();
  plugins.push(...vscodePlugins);

  // Continue with existing logic...
}
```

### 3. (Optional) Add Platform to Types

If you're adding a platform not already in the list, update `types/plugin.ts`:

```typescript
export type Platform = 'obsidian' | 'vscode' | 'jetbrains' | 'your-new-platform';

export const PLATFORM_LABELS: Record<Platform, string> = {
  obsidian: 'Obsidian',
  vscode: 'VS Code',
  'your-new-platform': 'Your Platform Name',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  'your-new-platform': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
```

## Platform Data Sources

Here are some common platform plugin APIs:

### VS Code
- **Marketplace API**: `https://marketplace.visualstudio.com/`
- **Extensions Query API**: `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`
- **GitHub**: Many extensions list on [awesome-vscode](https://github.com/viatsko/awesome-vscode)

### JetBrains
- **Plugin Repository**: `https://plugins.jetbrains.com/`
- **API**: `https://plugins.jetbrains.com/api/plugins`
- **Docs**: [JetBrains Marketplace API](https://plugins.jetbrains.com/docs/marketplace/api-reference.html)

### Sublime Text
- **Package Control**: `https://packagecontrol.io/`
- **Channel File**: `https://packagecontrol.io/channel_v3.json`
- **Docs**: [Package Control API](https://packagecontrol.io/docs/api)

### Vim/Neovim
- **VimAwesome**: `https://vimawesome.com/`
- **GitHub Topics**: Many plugins tagged with `vim-plugin` or `neovim-plugin`

### Atom
- **Packages API**: `https://atom.io/api/packages`
- **Docs**: [Atom Package API](https://flight-manual.atom.io/using-atom/sections/atom-packages/)

## Plugin Data Structure

Each plugin must have these required fields:

```typescript
{
  id: string;          // Unique identifier
  name: string;        // Display name
  author: string;      // Author/publisher name
  description: string; // Short description
  repo: string;        // GitHub repo (format: "owner/repo")
  platform: Platform;  // Platform identifier
  
  // Optional fields:
  branch?: string;
  authorUrl?: string;
  fundingUrl?: string;
}
```

## Example: Adding VS Code Support

Here's a complete example for VS Code:

```javascript
// scripts/fetch-vscode.js
const https = require('https');

const VSCODE_QUERY = {
  filters: [{
    criteria: [
      { filterType: 8, value: "Microsoft.VisualStudio.Code" },
      { filterType: 10, value: "target:\"Microsoft.VisualStudio.Code\"" }
    ],
    pageSize: 1000,
    pageNumber: 1,
    sortBy: 4, // Sort by install count
    sortOrder: 2
  }],
  flags: 914
};

async function fetchVSCodePlugins() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(VSCODE_QUERY);
    
    const options = {
      hostname: 'marketplace.visualstudio.com',
      path: '/_apis/public/gallery/extensionquery',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=3.0-preview.1',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        const extensions = result.results[0].extensions;
        
        const plugins = extensions.map(ext => ({
          id: ext.extensionId,
          name: ext.displayName,
          author: ext.publisher.displayName,
          description: ext.shortDescription || '',
          repo: extractRepo(ext.versions[0].properties),
          platform: 'vscode'
        }));
        
        resolve(plugins);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function extractRepo(properties) {
  const repoProp = properties.find(p => p.key === 'Microsoft.VisualStudio.Services.Links.GitHub');
  if (repoProp) {
    // Convert https://github.com/owner/repo to owner/repo
    return repoProp.value.replace('https://github.com/', '');
  }
  return '';
}

module.exports = { fetchVSCodePlugins };
```

Then update `scripts/fetch-plugins.js`:

```javascript
const { fetchVSCodePlugins } = require('./fetch-vscode');

async function main() {
  console.log('🚀 Starting plugin data fetch...\n');

  try {
    savePreviousData();

    // Fetch Obsidian plugins
    console.log('📥 Fetching Obsidian plugins...');
    const obsidianPlugins = await fetchJSON(OBSIDIAN_PLUGINS_URL);
    console.log(`✓ Fetched ${obsidianPlugins.length} Obsidian plugins\n`);
    
    const plugins = obsidianPlugins.map(plugin => ({
      ...plugin,
      platform: 'obsidian'
    }));

    // Fetch VS Code plugins
    console.log('📥 Fetching VS Code plugins...');
    const vscodePlugins = await fetchVSCodePlugins();
    console.log(`✓ Fetched ${vscodePlugins.length} VS Code plugins\n`);
    
    plugins.push(...vscodePlugins);

    // Rest of the code stays the same...
    console.log(`✓ Total: ${plugins.length} plugins across ${new Set(plugins.map(p => p.platform)).size} platforms\n`);
    
    // Continue with existing logic...
  }
}
```

## UI Updates

**The UI automatically adapts!** No changes needed:

- ✅ Platform filter buttons appear automatically
- ✅ Platform badges show on each card
- ✅ Plugin counts update dynamically
- ✅ Search works across all platforms

## Testing

After adding a new platform:

1. Run the fetch script:
   ```bash
   npm run fetch-plugins
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Check the platform filter - your new platform should appear!

4. Verify:
   - Platform badge shows correctly on cards
   - Filter works
   - Plugin count is accurate
   - Search works

## Tips

- **Rate Limiting**: Some APIs have rate limits. Consider caching results.
- **Error Handling**: Always handle API errors gracefully.
- **Data Quality**: Validate that repo URLs are in correct format.
- **Testing**: Test with a small subset first.
- **Documentation**: Update README with the new platform.

## Need Help?

- Check existing fetch scripts for reference
- Review API documentation for the platform
- Test locally before deploying
- Open an issue if you encounter problems

---

Created by [@seckinalp](https://github.com/seckinalp)

