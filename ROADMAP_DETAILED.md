# Detailed Roadmap - Plugin Discovery Hub

This document provides detailed implementation plans for each phase of development.

## Phase 1: Foundation & Obsidian MVP ✅ COMPLETED

**Status:** Production Ready  
**Live:** [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

### Completed Features
- ✅ Modern Next.js 14 application with TypeScript
- ✅ Tailwind CSS styling with dark mode
- ✅ Obsidian plugin data fetching (2,636+ plugins)
- ✅ Real-time search and filtering
- ✅ Platform-based filtering
- ✅ Export as JSON, SQL, CSV
- ✅ RSS feed for new plugins
- ✅ Daily automated updates via GitHub Actions
- ✅ Vercel deployment with auto-deploy

---

## Phase 2: GitHub API Integration & Enhanced Metrics

**Status:** Planning  
**Estimated Timeline:** 2-3 weeks  
**Priority:** High

### Goals
Enrich plugin data with GitHub repository statistics to help users make informed decisions about which plugins to use.

### 2.1 GitHub API Integration

**Implementation Plan:**

#### Step 1: Setup GitHub API Client
```javascript
// utils/github.js
const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';

async function fetchRepoStats(owner, repo) {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: {
      'Authorization': `token ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  const data = await response.json();
  
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    lastUpdated: data.pushed_at,
    license: data.license?.name,
    description: data.description,
    homepage: data.homepage,
    topics: data.topics,
    language: data.language,
    size: data.size,
    defaultBranch: data.default_branch,
    createdAt: data.created_at,
    hasWiki: data.has_wiki,
    hasPages: data.has_pages,
    archived: data.archived,
    disabled: data.disabled
  };
}
```

#### Step 2: Update Fetch Script
```javascript
// scripts/fetch-plugins-enhanced.js
async function fetchPluginsWithStats() {
  // Fetch base plugin data
  const plugins = await fetchJSON(OBSIDIAN_PLUGINS_URL);
  
  // Rate limiting: max 5000 requests/hour for authenticated users
  const BATCH_SIZE = 100; // Process in batches
  const DELAY_MS = 1000; // 1 second between batches
  
  for (let i = 0; i < plugins.length; i += BATCH_SIZE) {
    const batch = plugins.slice(i, i + BATCH_SIZE);
    
    const enhancedBatch = await Promise.all(
      batch.map(async (plugin) => {
        try {
          const [owner, repo] = plugin.repo.split('/');
          const stats = await fetchRepoStats(owner, repo);
          return { ...plugin, github: stats };
        } catch (error) {
          console.error(`Failed to fetch stats for ${plugin.id}:`, error);
          return plugin; // Return without stats if fails
        }
      })
    );
    
    // Merge enhanced plugins
    plugins.splice(i, BATCH_SIZE, ...enhancedBatch);
    
    // Wait before next batch
    if (i + BATCH_SIZE < plugins.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return plugins;
}
```

#### Step 3: Update Type Definitions
```typescript
// types/plugin.ts
export interface GitHubStats {
  stars: number;
  forks: number;
  openIssues: number;
  lastUpdated: string;
  license?: string;
  homepage?: string;
  topics?: string[];
  language?: string;
  createdAt: string;
  archived?: boolean;
  disabled?: boolean;
}

export interface BasePlugin {
  // ... existing fields
  github?: GitHubStats; // Optional for backwards compatibility
}
```

### 2.2 Advanced Filtering & Sorting

**UI Components:**

#### Filter Panel Component
```tsx
// components/FilterPanel.tsx
export default function FilterPanel() {
  return (
    <div className="space-y-4">
      <div>
        <label>Sort By</label>
        <select>
          <option value="name">Name (A-Z)</option>
          <option value="stars">Most Stars</option>
          <option value="updated">Recently Updated</option>
          <option value="forks">Most Forks</option>
          <option value="created">Newest</option>
        </select>
      </div>
      
      <div>
        <label>Minimum Stars</label>
        <input type="number" min="0" placeholder="e.g., 100" />
      </div>
      
      <div>
        <label>Last Updated</label>
        <select>
          <option value="any">Any time</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
          <option value="year">Past year</option>
        </select>
      </div>
      
      <div>
        <label>License</label>
        <select multiple>
          <option value="mit">MIT</option>
          <option value="apache-2.0">Apache 2.0</option>
          <option value="gpl-3.0">GPL 3.0</option>
        </select>
      </div>
    </div>
  );
}
```

#### Enhanced Plugin Card
```tsx
// components/PluginCard.tsx
export default function PluginCard({ plugin }: PluginCardProps) {
  const { github } = plugin;
  
  return (
    <div className="plugin-card">
      {/* Existing content */}
      
      {github && (
        <div className="stats">
          <span>⭐ {github.stars.toLocaleString()}</span>
          <span>🍴 {github.forks.toLocaleString()}</span>
          <span>🐛 {github.openIssues}</span>
          <span>📅 {formatDate(github.lastUpdated)}</span>
        </div>
      )}
    </div>
  );
}
```

### 2.3 Plugin Detail Pages

**Route Structure:**
```
/plugin/[id] - Individual plugin page
```

**Implementation:**

#### Plugin Detail Page
```tsx
// app/plugin/[id]/page.tsx
export default async function PluginDetailPage({ params }) {
  const plugin = await getPluginById(params.id);
  const readme = await fetchReadme(plugin.repo);
  
  return (
    <div className="max-w-4xl mx-auto">
      <header>
        <h1>{plugin.name}</h1>
        <p>{plugin.description}</p>
        
        <div className="stats-grid">
          <StatCard icon="⭐" label="Stars" value={plugin.github.stars} />
          <StatCard icon="🍴" label="Forks" value={plugin.github.forks} />
          <StatCard icon="🐛" label="Issues" value={plugin.github.openIssues} />
          <StatCard icon="👀" label="Watchers" value={plugin.github.watchers} />
        </div>
      </header>
      
      <section className="readme">
        <h2>README</h2>
        <ReactMarkdown>{readme}</ReactMarkdown>
      </section>
      
      <section className="activity">
        <h2>Activity</h2>
        <CommitActivityChart repo={plugin.repo} />
      </section>
      
      <aside className="info">
        <h3>Information</h3>
        <dl>
          <dt>Author</dt>
          <dd>{plugin.author}</dd>
          
          <dt>License</dt>
          <dd>{plugin.github.license}</dd>
          
          <dt>Platform</dt>
          <dd>{plugin.platform}</dd>
          
          <dt>Last Updated</dt>
          <dd>{formatDate(plugin.github.lastUpdated)}</dd>
        </dl>
      </aside>
    </div>
  );
}
```

### 2.4 Rate Limiting & Caching

**Implementation:**

```javascript
// utils/cache.js
const CACHE_DIR = path.join(__dirname, '../.cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getCachedData(key) {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  if (fs.existsSync(cachePath)) {
    const { data, timestamp } = JSON.parse(fs.readFileSync(cachePath));
    
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }
  
  return null;
}

function setCachedData(key, data) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(cachePath, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
}

// Rate limiter
class RateLimiter {
  constructor(maxRequests = 5000, windowMs = 60 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  async waitForSlot() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }
    
    this.requests.push(now);
  }
}
```

### 2.5 Performance Metrics

**Health Indicators:**

```tsx
function getPluginHealth(plugin: BasePlugin) {
  if (!plugin.github) return null;
  
  const daysSinceUpdate = getDaysSince(plugin.github.lastUpdated);
  
  if (plugin.github.archived || plugin.github.disabled) {
    return { status: 'archived', label: 'Archived', color: 'gray' };
  }
  
  if (daysSinceUpdate > 365) {
    return { status: 'abandoned', label: 'Inactive', color: 'red' };
  }
  
  if (daysSinceUpdate > 180) {
    return { status: 'stale', label: 'Stale', color: 'yellow' };
  }
  
  if (daysSinceUpdate < 30) {
    return { status: 'active', label: 'Active', color: 'green' };
  }
  
  return { status: 'maintained', label: 'Maintained', color: 'blue' };
}
```

### Environment Setup

**Required:**
1. GitHub Personal Access Token with `public_repo` scope
2. Add to Vercel environment variables: `GH_TOKEN`
3. Add to GitHub Secrets for Actions: `GH_TOKEN`

**Note:** Don't use `GITHUB_TOKEN` as a secret name - GitHub reserves names starting with `GITHUB_`. Use `GH_TOKEN` or `PERSONAL_ACCESS_TOKEN` instead.

### Dependencies to Add

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "recharts": "^2.10.0"
  }
}
```

---

## Phase 3: Multi-Platform Expansion

**Status:** Future  
**Target Platforms:**
- VS Code Extensions
- JetBrains Plugins
- Sublime Text Packages
- Vim/Neovim Plugins

---

## Phase 4: Advanced Features

**Potential Features:**
- User accounts and favorites
- Plugin comparison tool
- Trending plugins dashboard
- Category/tag system
- Plugin recommendations
- API for developers
- Community ratings and reviews

---

## Implementation Priority

### High Priority (Phase 2)
1. GitHub API integration (core metrics)
2. Enhanced sorting (stars, updated)
3. Basic detail pages

### Medium Priority (Phase 2)
1. Advanced filtering
2. README rendering
3. Activity charts

### Low Priority (Later)
1. Full analytics
2. Historical data
3. Predictive features

---

Created by [@seckinalp](https://github.com/seckinalp)

