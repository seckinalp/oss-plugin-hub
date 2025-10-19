# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-10-10

### 🎉 Major Updates - Multi-Platform Support & Export

#### Added
- **Multi-platform support** - App now supports multiple plugin platforms
- **Platform filter** - Interactive platform selector with plugin counts
- **Platform badges** - Color-coded badges on each plugin card showing the platform
- **Platform types** - 7 predefined platforms (Obsidian, VS Code, JetBrains, Sublime, Atom, Vim, Other)
- **Export functionality** - Export filtered/searched results as JSON, SQL, or CSV
- **Export utils** - New utility functions for data export in multiple formats
- **ADDING_PLATFORMS.md** - Comprehensive guide for adding new platforms
- **GitHub link** - Footer now includes link to @seckinalp

#### Changed
- Updated all plugin data to include `platform` field (currently all set to "obsidian")
- Enhanced `PluginCard` component to display platform badges
- Enhanced `PluginGrid` component with platform filtering
- Updated header description to mention multiple platforms
- Updated footer to reference "open-source community" instead of just "Obsidian community"
- Updated README.md with platform support information
- Updated CONTRIBUTING.md with platform addition guide

#### Technical Changes
- New `Platform` type definition with 7 platform options
- New `BasePlugin` interface replacing `ObsidianPlugin` as primary type
- Platform-specific color schemes defined in `PLATFORM_COLORS`
- Platform-specific labels defined in `PLATFORM_LABELS`
- Fetch script now adds `platform: 'obsidian'` to all fetched plugins
- UI automatically adapts to available platforms in the data

### 🎨 UI Improvements
- Platform filter buttons with active state styling
- Color-coded platform badges for easy visual identification
- Dynamic plugin counts per platform
- Responsive platform filter layout
- Export buttons with icons (JSON, SQL, CSV)
- Export section shows count of filtered plugins
- Color-coded export buttons (Indigo for JSON, Green for SQL, Emerald for CSV)

### 📚 Documentation
- Added detailed guide for adding new platforms
- Updated README with supported platforms list
- Updated CONTRIBUTING guide with platform addition workflow
- Added examples for VS Code, JetBrains, Sublime Text APIs

## [0.1.0] - 2025-10-10

### Initial Release

#### Added
- Next.js 14 application with TypeScript and Tailwind CSS
- Obsidian plugin data fetching from official repository
- Search and filter functionality
- Responsive grid layout
- Dark mode support
- GitHub Actions for daily automated updates
- Vercel deployment configuration
- Comprehensive documentation

#### Features
- Browse 2,636+ Obsidian plugins
- Real-time search by name, author, or description
- Sort by name or author
- Beautiful, modern UI with gradient background
- Plugin cards with GitHub repository links
- Daily automated data updates

---

## Future Plans

### Planned for v0.3.0 - GitHub Integration
- GitHub API integration for repository metrics
- Advanced sorting (stars, forks, last updated)
- Enhanced filtering (minimum stars, update date, license)
- Plugin health indicators (active/maintained/stale/archived)
- Rate limiting and caching system

### Planned for v0.4.0 - Plugin Detail Pages
- Dedicated plugin detail pages
- README.md rendering
- Repository statistics and charts
- Activity graphs
- Installation instructions

### Planned for v0.5.0 - Multi-Platform
- Add VS Code plugin support
- Add JetBrains plugin support
- Platform-specific metrics
- Cross-platform plugin discovery

### Planned for v1.0.0 - Advanced Features
- Plugin comparison feature
- Trending plugins dashboard
- Category/tag filtering
- API endpoint for developers
- Advanced analytics and insights

---

Created by [@seckinalp](https://github.com/seckinalp)

