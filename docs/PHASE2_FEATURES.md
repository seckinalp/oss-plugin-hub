# Phase 2 Features: GitHub API Integration

This document provides an overview of the Phase 2 features implemented in the Plugin Discovery Hub.

## 🚀 What's New in Phase 2

### 1. GitHub API Integration

The app now fetches real-time repository statistics from GitHub for each plugin:

- **Repository Metrics**:
  - ⭐ Star count
  - 🍴 Fork count
  - 🐛 Open issues
  - 👀 Watchers

- **Additional Data**:
  - 📅 Last commit date
  - 📅 Repository creation date
  - 📜 License information
  - 🏠 Homepage URL
  - 🏷️ Topics/tags
  - 💻 Primary language
  - 📦 Repository size
  - ⚠️ Archived/disabled status

### 2. Plugin Detail Pages

Each plugin now has its own dedicated page at `/plugin/[id]`:

- **Comprehensive Overview**: Full plugin metadata and GitHub stats
- **README Display**: Rendered README.md with GitHub Flavored Markdown support
- **Statistics Dashboard**: Visual display of stars, forks, issues, and watchers
- **Health Indicators**: Status badges showing plugin maintenance level
- **Platform Badges**: Color-coded platform indicators
- **Quick Links**: GitHub repository, homepage, and funding links
- **Topics**: Repository tags and categories

### 3. Advanced Filtering & Sorting

Enhanced plugin discovery with powerful filters and sorting options:

- **Sort By**:
  - Name (A-Z)
  - Author
  - Most Stars
  - Most Forks
  - Recently Updated
  - Newest

- **Filters**:
  - Minimum Stars: Filter plugins by star count
  - Platform: Filter by development platform
  - Search: Text search across name, author, and description

### 4. Health Indicators

Visual status badges that automatically categorize plugins based on their last update:

- **Active** 🟢 (< 30 days): Recently updated, actively maintained
- **Maintained** 🔵 (< 180 days): Regularly maintained
- **Stale** 🟡 (< 365 days): Less frequent updates
- **Inactive** 🔴 (> 365 days): No recent updates

### 5. Enhanced Plugin Cards

Plugin cards now display:
- Platform badge
- Health status badge
- GitHub statistics (stars, forks, last updated)
- Click to open detail page

## 🛠️ Technical Implementation

### New Files

1. **`utils/github.ts`**: GitHub API utility functions
   - `fetchRepoStats()`: Fetch repository statistics
   - `fetchReadme()`: Fetch README content
   - `checkRateLimit()`: Monitor API usage
   - `getPluginHealth()`: Calculate health status
   - Helper functions for formatting

2. **`app/plugin/[id]/page.tsx`**: Plugin detail page component
   - Server-side rendering
   - `generateStaticParams()` for static export
   - README rendering with react-markdown

3. **`app/plugin/[id]/not-found.tsx`**: 404 page for missing plugins

4. **`scripts/update-github-stats.js`**: Batch update script
   - Fetches GitHub stats for all plugins
   - Rate limit handling
   - Progress reporting

### Updated Files

1. **`types/plugin.ts`**: Added `GitHubStats` interface
2. **`components/PluginCard.tsx`**: Enhanced with GitHub stats and health indicators
3. **`components/PluginGrid.tsx`**: Advanced sorting and filtering
4. **`package.json`**: Added dependencies:
   - `react-markdown`: README rendering
   - `remark-gfm`: GitHub Flavored Markdown support

## 📊 Usage

### Viewing Plugin Details

Click on any plugin card to open its detail page. The detail page shows:
- Full repository statistics
- README content
- Health status
- Platform information
- Links and resources

### Advanced Filtering

1. Click "Show Filters" to open the advanced filters panel
2. Set minimum star count
3. Select platform
4. Use the sort dropdown for different ordering

### Updating GitHub Stats

To fetch the latest GitHub statistics for all plugins:

```bash
npm run update-github-stats
```

**Requirements:**
- GitHub Personal Access Token (GH_TOKEN) in environment
- See `GITHUB_TOKEN_SETUP.md` for setup instructions

**Rate Limits:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

## 🎨 UI/UX Improvements

### Plugin Cards
- Hover effects with border highlight
- Health status badges
- GitHub stats preview
- Clickable to detail page

### Detail Pages
- Clean, organized layout
- Sidebar with quick info
- README rendering with proper styling
- Responsive design

### Filters
- Collapsible advanced filters panel
- Clear visual feedback
- Persistent state during session
- Real-time filtering

## 🔐 Environment Variables

```bash
# Optional but recommended for GitHub API
GH_TOKEN=ghp_your_github_token_here
```

See `GITHUB_TOKEN_SETUP.md` for detailed setup instructions.

## 🚀 Next Steps (Phase 3)

- Add support for VS Code extensions
- Add support for JetBrains plugins
- Implement platform-specific features
- Cross-platform plugin discovery

## 📝 Notes

- GitHub stats are fetched at build time for static export
- Detail pages are pre-generated for all plugins
- Rate limit handling prevents API exhaustion
- Health indicators are calculated automatically

