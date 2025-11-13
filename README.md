# 🔌 Plugin Discovery Hub

A modern web application for discovering and exploring open-source plugins across multiple platforms, including Obsidian, VS Code, Firefox, Home Assistant, WordPress, JetBrains, Sublime Text, and Minecraft.

🌐 **[Live Demo](https://oss-plugin-hub.vercel.app/)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit `http://localhost:3000` to see the app running!

> **Note**: The app uses **dynamic rendering** to handle 78,634+ plugins efficiently. If you encounter build issues, see [BUILD_FIX_SUMMARY.md](BUILD_FIX_SUMMARY.md) for troubleshooting.

---

## ✨ Features

- 🔍 **Browse & Search** - Explore 2,389+ Home Assistant components, 2,636+ Obsidian plugins, 25,136+ VS Code extensions, 60,000+ WordPress plugins, JetBrains plugins, Sublime Text packages, and Minecraft mods with real-time search
- 🎯 **Platform Filter** - Filter by platform (Obsidian, VS Code, Firefox, Home Assistant, WordPress, JetBrains, Sublime Text, Minecraft, and more)
- 📊 **Advanced Metrics** - GitHub stars, forks, issues, last updated, and more
- 📥 **Export Data** - Export filtered results as JSON, SQL, or CSV
- 🌙 **Dark Mode** - Beautiful dark theme support
- 📱 **Responsive** - Works seamlessly on desktop, tablet, and mobile
- 🔗 **Plugin Details** - Dedicated pages with README, stats, and insights
- ⚡ **Fast & Modern** - Built with Next.js 14 and optimized for performance

---

## 🚀 Quick Start

### For Users

Simply visit the live site - no installation required!

🌐 **[https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)**

### For Developers

1. **Clone the repository**
   ```bash
   git clone https://github.com/seckinalp/oss-plugin-hub.git
   cd oss-plugin-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Fetch plugin data**
   ```bash
   npm run fetch-all-sources   # Fetch Obsidian + VS Code + Firefox + Home Assistant + WordPress + JetBrains + Sublime Text + Minecraft
   # OR fetch individually:
   # npm run fetch-obsidian     # Obsidian only
   # npm run fetch-vscode       # VS Code only
   # npm run fetch-firefox       # Firefox only
   # npm run fetch-homeassistant # Home Assistant only
   # npm run fetch-wordpress     # WordPress only
   # npm run fetch-jetbrains     # JetBrains only
   # npm run fetch-sublime       # Sublime Text only
   # npm run fetch-minecraft     # Minecraft mods only
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 📦 Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Data Management
```bash
npm run fetch-obsidian      # Fetch Obsidian plugins
npm run fetch-vscode        # Fetch VS Code extensions
npm run fetch-firefox       # Fetch Firefox addons
npm run fetch-homeassistant # Fetch Home Assistant components
npm run fetch-wordpress     # Fetch WordPress plugins
npm run fetch-jetbrains     # Fetch JetBrains plugins
npm run fetch-sublime       # Fetch Sublime Text packages
npm run fetch-minecraft-modrinth  # Fetch ALL Modrinth project types (mods, resource packs, data packs, shaders, modpacks)
npm run fetch-minecraft-curseforge # Fetch Minecraft mods from CurseForge (requires API key)
npm run fetch-minecraft-spiget    # Fetch Minecraft server plugins from Spiget
npm run fetch-minecraft     # Fetch Minecraft mods from Modrinth + Spiget
npm run fetch-all-sources   # Fetch all platforms (Obsidian, VS Code, Firefox, Home Assistant, WordPress, JetBrains, Sublime Text, Minecraft)
npm run update-stats        # Update GitHub stats for all platforms (incremental)
npm run update-stats:force  # Update all stats for all platforms (full refresh)
npm run update-stats:obsidian    # Update GitHub stats for Obsidian only
npm run update-stats:vscode      # Update GitHub stats for VS Code only
npm run update-stats:firefox     # Update GitHub stats for Firefox only
npm run update-stats:homeassistant # Update GitHub stats for Home Assistant only
npm run update-stats:wordpress   # Update GitHub stats for WordPress only
npm run update-stats:jetbrains   # Update GitHub stats for JetBrains only
npm run update-stats:sublime     # Update GitHub stats for Sublime Text only
npm run update-stats:minecraft   # Update GitHub stats for Minecraft only
npm run update-stats:obsidian:force  # Force update all Obsidian stats
npm run update-stats:vscode:force    # Force update all VS Code stats
npm run update-stats:firefox:force  # Force update all Firefox stats
npm run update-stats:homeassistant:force # Force update all Home Assistant stats
npm run update-stats:wordpress:force # Force update all WordPress stats
npm run update-stats:jetbrains:force # Force update all JetBrains stats
npm run update-stats:sublime:force # Force update all Sublime Text stats
npm run update-stats:minecraft:force # Force update all Minecraft stats
npm run fetch-all          # Fetch all sources and update stats
```

---

## 🔧 Data Fetching & GitHub API

### Quick Start

#### 1. Fetch Plugin Lists

**Fetch Obsidian plugins:**
```bash
npm run fetch-obsidian
```
Downloads the latest Obsidian plugins list (no token required).

**Fetch VS Code extensions:**
```bash
npm run fetch-vscode
```
Fetches top 1,000 VS Code extensions from the marketplace (no token required).

> **Note:** VS Code has 50,000+ extensions. To fetch more:
> ```bash
> # Fetch 5,000 extensions (top by installs)
> VSCODE_MAX_PAGES=50 npm run fetch-vscode
> 
> # Windows PowerShell:
> $env:VSCODE_MAX_PAGES=50; npm run fetch-vscode
> ```

**Fetch Firefox addons:**
```bash
npm run fetch-firefox
```
Fetches Firefox addons from Mozilla Add-ons API (no token required). By default, only fetches addons with GitHub repositories.

> **Note:** Firefox has 10,000+ addons. To fetch more or include addons without GitHub repos:
> ```bash
> # Fetch 2,000 addons (top by users)
> FIREFOX_MAX_PAGES=20 npm run fetch-firefox
> 
> # Include addons without GitHub repos
> FIREFOX_GITHUB_ONLY=false npm run fetch-firefox
> 
> # Windows PowerShell:
> $env:FIREFOX_MAX_PAGES=20; npm run fetch-firefox
> $env:FIREFOX_GITHUB_ONLY="false"; npm run fetch-firefox
> ```

**Fetch Home Assistant components:**
```bash
npm run fetch-homeassistant
```
Fetches Home Assistant components from the official HACS (Home Assistant Community Store) default repository. Includes all 7 categories:
- **integration** (1,745 components) - Custom integrations
- **plugin** (466 components) - Frontend plugins  
- **theme** (92 components) - UI themes
- **appdaemon** (61 components) - Python automation apps
- **template** (11 components) - Templates
- **python_script** (10 components) - Python scripts
- **netdaemon** (4 components) - .NET apps

> **Note:** This fetches from the official HACS default repository at `https://github.com/hacs/default`. No token required.

**Fetch WordPress plugins:**
```bash
npm run fetch-wordpress
```
Fetches WordPress plugins from the official WordPress.org API using pagination. By default, only fetches plugins with GitHub repositories.

> **Note:** WordPress has 60,000+ plugins. To fetch more or include plugins without GitHub repos:
> ```bash
> # Fetch 7,000 plugins (top by active installs)
> WORDPRESS_MAX_PAGES=10 npm run fetch-wordpress
> 
> # Include plugins without GitHub repos
> WORDPRESS_GITHUB_ONLY=false npm run fetch-wordpress
> 
> # Windows PowerShell:
> $env:WORDPRESS_MAX_PAGES=10; npm run fetch-wordpress
> $env:WORDPRESS_GITHUB_ONLY="false"; npm run fetch-wordpress
> ```

**Fetch JetBrains plugins:**
```bash
npm run fetch-jetbrains
```
Fetches JetBrains plugins from the official JetBrains Marketplace API using infinite pagination. Uses a two-stage approach:
1. **Search API** - Discovers plugins with `hasSource: true` flag
2. **Detail API** - Fetches GitHub repository URLs for plugins with source code

By default, only fetches plugins with GitHub repositories. Uses infinite pagination to automatically fetch ALL available plugins.

> **Note:** JetBrains API has a maximum page size of 20 plugins per page. The script automatically continues until all plugins are fetched.
> ```bash
> # Customize page size (max 20)
> JETBRAINS_PAGE_SIZE=20 npm run fetch-jetbrains
> 
> # Include plugins without GitHub repos
> JETBRAINS_GITHUB_ONLY=false npm run fetch-jetbrains
> 
> # Windows PowerShell:
> $env:JETBRAINS_PAGE_SIZE=20; npm run fetch-jetbrains
> $env:JETBRAINS_GITHUB_ONLY="false"; npm run fetch-jetbrains
> ```

**Fetch Sublime Text packages:**
```bash
npm run fetch-sublime
```
Fetches Sublime Text packages from the Package Control API. Package Control is the de facto package manager for Sublime Text, providing access to thousands of packages.

By default, only fetches packages with GitHub repositories.

> **Note:** Package Control has thousands of packages available. To include packages without GitHub repos:
> ```bash
> # Include packages without GitHub repos
> SUBLIME_GITHUB_ONLY=false npm run fetch-sublime
> 
> # Windows PowerShell:
> $env:SUBLIME_GITHUB_ONLY="false"; npm run fetch-sublime
> ```

**Fetch Minecraft mods, packs, shaders and plugins:**
```bash
npm run fetch-minecraft
```
Fetches Minecraft content from multiple sources:

- **Modrinth** (`npm run fetch-minecraft-modrinth`) - ALL project types (mods, resource packs, data packs, shaders, modpacks)
- **Spiget** (`npm run fetch-minecraft-spiget`) - Server plugins for Spigot, Paper, and Bukkit
- **CurseForge** (`npm run fetch-minecraft-curseforge`) - Additional mods (requires API key)

By default, only fetches mods/plugins with GitHub repositories.

> **Note:** Minecraft has thousands of mods and plugins available. To customize fetching:
> ```bash
# Fetch more Modrinth projects (default: 2200 pages = 220,000 projects per type)
MODRINTH_MAX_PAGES=5000 npm run fetch-minecraft-modrinth

# Include projects without GitHub repos (will get much more data)
MODRINTH_GITHUB_ONLY=false npm run fetch-minecraft-modrinth

# Increase delays to avoid rate limits (slower but more reliable)
MODRINTH_BATCH_DELAY=5000 MODRINTH_RETRY_DELAY=15000 npm run fetch-minecraft-modrinth

# Fetch more Spiget plugins (default: 30 pages = 3,000 plugins)
SPIGET_MAX_PAGES=50 npm run fetch-minecraft-spiget

# Include plugins without GitHub repos
SPIGET_GITHUB_ONLY=false npm run fetch-minecraft-spiget

# CurseForge requires API key (apply at https://docs.curseforge.com/)
CURSEFORGE_API_KEY=your_api_key npm run fetch-minecraft-curseforge

# Windows PowerShell:
$env:MODRINTH_MAX_PAGES=5000; npm run fetch-minecraft-modrinth
$env:MODRINTH_GITHUB_ONLY="false"; npm run fetch-minecraft-modrinth
$env:MODRINTH_BATCH_DELAY=5000; $env:MODRINTH_RETRY_DELAY=15000; npm run fetch-minecraft-modrinth
$env:SPIGET_MAX_PAGES=50; npm run fetch-minecraft-spiget
$env:SPIGET_GITHUB_ONLY="false"; npm run fetch-minecraft-spiget
$env:CURSEFORGE_API_KEY="your_api_key"; npm run fetch-minecraft-curseforge
```

**Fetch all platforms:**
```bash
npm run fetch-all-sources  # Obsidian, VS Code, Firefox, Home Assistant, WordPress, JetBrains, Sublime Text, and Minecraft
```

**Fetch individual platforms:**
```bash
npm run fetch-obsidian      # Obsidian plugins only
npm run fetch-vscode        # VS Code extensions only
npm run fetch-firefox       # Firefox addons only
npm run fetch-homeassistant # Home Assistant components only
npm run fetch-wordpress     # WordPress plugins only
npm run fetch-jetbrains     # JetBrains plugins only
npm run fetch-sublime       # Sublime Text packages only
npm run fetch-minecraft     # Minecraft mods and plugins only
```

#### 2. Update GitHub Stats

**Update all platforms (incremental):**
```bash
npm run update-stats
```

**Update specific platform:**
```bash
npm run update-stats:obsidian      # Only Obsidian plugins
npm run update-stats:vscode        # Only VS Code extensions
npm run update-stats:firefox       # Only Firefox addons
npm run update-stats:homeassistant # Only Home Assistant components
npm run update-stats:wordpress     # Only WordPress plugins
npm run update-stats:jetbrains     # Only JetBrains plugins
npm run update-stats:sublime       # Only Sublime Text packages
npm run update-stats:minecraft     # Only Minecraft mods and plugins
```

**Force update (re-fetch all):**
```bash
npm run update-stats:force             # All platforms
npm run update-stats:obsidian:force    # Obsidian only
npm run update-stats:vscode:force      # VS Code only
npm run update-stats:firefox:force     # Firefox only
npm run update-stats:homeassistant:force # Home Assistant only
npm run update-stats:wordpress:force   # WordPress only
npm run update-stats:jetbrains:force   # JetBrains only
npm run update-stats:sublime:force     # Sublime Text only
npm run update-stats:minecraft:force   # Minecraft only
```

### Typical Workflows

#### First Time Setup
```bash
# 1. Get all plugin lists
npm run fetch-all-sources

# 2. Get GitHub stats for all platforms (will take 1-2 hours)
npm run update-stats

# 3. Commit
git add data/
git commit -m "Initial data"
git push
```

#### Daily/Weekly Updates (Recommended)
```bash
# Just fetch new plugins and their stats
npm run fetch-all

# Commit if there are changes
git add data/
git commit -m "Update plugin data"
git push
```

#### Platform-Specific Updates
```bash
# Update only Obsidian plugins
npm run fetch-obsidian
npm run update-stats:obsidian

# Update only VS Code extensions
npm run fetch-vscode
npm run update-stats:vscode

# Update only Firefox addons
npm run fetch-firefox
npm run update-stats:firefox

# Update only WordPress plugins
npm run fetch-wordpress
npm run update-stats:wordpress

# Update only JetBrains plugins
npm run fetch-jetbrains
npm run update-stats:jetbrains

# Update only Sublime Text packages
npm run fetch-sublime
npm run update-stats:sublime

# Update only Minecraft mods and plugins
npm run fetch-minecraft
npm run update-stats:minecraft
```

#### Monthly Full Refresh
```bash
# Re-fetch everything
npm run fetch-all-sources
npm run update-stats:force

# Commit
git add data/
git commit -m "Monthly full update"
git push
```

### GitHub Token Setup (Important!)

The stats update script makes ~21 API requests per plugin:
- **Without token**: 60 requests/hour → ~2-3 plugins/hour ⏳
- **With token**: 5000 requests/hour → ~240 plugins/hour ⚡

#### Get a Token
1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new)
2. Name it: "OSS Plugin Hub"
3. No special permissions needed (public repo access)
4. Generate and copy the token

#### Set the Token

**Windows PowerShell:**
```powershell
$env:GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

**Linux/Mac:**
```bash
export GH_TOKEN="ghp_your_token_here"
npm run update-stats
```

**Using .env file** (recommended):
```bash
# Create .env file in project root
echo "GH_TOKEN=ghp_your_token_here" > .env
```

### What Data Gets Fetched?

For each plugin, the script fetches:
- ⭐ Stars, forks, watchers
- 📝 Issues and PRs (open/closed)
- 🏷️ Latest version and releases
- 📖 README content
- 👥 Contributors
- 📊 Commit activity and health metrics
- 💻 Languages, dependencies, CI/CD
- 📜 Community files (LICENSE, CONTRIBUTING, etc.)
- 💰 Funding links

See [`scripts/README.md`](scripts/README.md) for detailed documentation.

---

## 📁 Project Structure

```
oss-plugin-hub/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── plugin/[id]/       # Plugin detail pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── PluginCard.tsx    # Individual plugin card
│   ├── PluginGrid.tsx    # Plugin grid with filters
│   ├── SearchBar.tsx     # Search component
│   └── RelativeTime.tsx  # Time formatting
├── data/                  # Plugin data storage
│   └── plugins.json      # All plugin data
├── scripts/               # Data fetching scripts
│   ├── fetch-plugins.js  # Fetch Obsidian plugins
│   ├── update-github-stats.js  # Fetch GitHub stats
│   └── README.md         # Scripts documentation
├── types/                 # TypeScript definitions
│   └── plugin.ts         # Plugin types
├── utils/                 # Utility functions
│   ├── export.ts         # Export functionality
│   └── github.ts         # GitHub API helpers
└── public/               # Static assets
```

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Markdown:** [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🌐 Supported Platforms

- ✅ **Obsidian** - Fully supported (2,636+ plugins)
- ✅ **VS Code** - Fully supported (25,136+ extensions with GitHub repos)
- ✅ **Firefox** - Fully supported (1,000+ addons with GitHub repos)
- ✅ **Home Assistant** - Fully supported (2,389+ components from HACS)
- ✅ **WordPress** - Fully supported (60,000+ plugins with GitHub repos)
- ✅ **JetBrains** - Fully supported (plugins with GitHub repos)
- ✅ **Sublime Text** - Fully supported (packages with GitHub repos)
- ✅ **Minecraft** - Fully supported (mods and server plugins with GitHub repos)
- 🔜 **More platforms** - Submit a request!

The app is designed to support multiple platforms! See the Contributing section below.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm run build
   npm run lint
   ```
5. **Commit with a clear message**
   ```bash
   git commit -m "feat: add awesome feature"
   ```
6. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Areas for Contribution

- **🌐 New Platforms** - Add more platforms like Atom, Vim, Emacs, etc.
- **✨ Features** - Advanced filtering, analytics, trending plugins, comparisons
- **🎨 UI/UX** - Improve design, accessibility, mobile experience
- **⚡ Performance** - Optimize build size, loading times, caching
- **📚 Documentation** - Improve guides, add examples, tutorials
- **🐛 Bug Fixes** - Fix reported issues
- **🧪 Testing** - Add unit tests, integration tests

### Adding New Platforms

The app is designed to make adding new platforms easy:

1. Create a fetch script in `scripts/` (e.g., `fetch-sublime-plugins.js`)
2. Add it to `package.json` scripts
3. Update the plugin types in `types/plugin.ts` if needed
4. The UI automatically adapts to show the new platform!

### Code Style

- Use TypeScript for type safety
- Follow the existing ESLint configuration
- Use meaningful variable and function names
- Keep components small and focused
- Add comments for complex logic
- Ensure responsive design and dark mode compatibility

---

## 🗺️ Roadmap

### Phase 1 - MVP ✅ Completed
- [x] Basic plugin discovery
- [x] Search and filter functionality
- [x] Export to JSON, SQL, CSV
- [x] Dark mode support
- [x] Responsive design

### Phase 2 - Advanced Metrics ✅ Completed
- [x] GitHub API integration
- [x] Repository statistics
- [x] Plugin detail pages
- [x] README rendering
- [x] Automated daily updates

### Phase 3 - Multi-Platform ✅ Completed
- [x] VS Code plugin support
- [x] Firefox addon support  
- [x] Home Assistant component support
- [x] WordPress plugin support
- [x] JetBrains plugin support
- [x] Sublime Text package support
- [x] Minecraft mod and plugin support
- [x] Cross-platform plugin discovery
- [x] Platform-specific metrics

### Phase 4 - Advanced Features 🔮 Future
- [ ] Plugin comparison tool
- [ ] Trending plugins dashboard
- [ ] Category/tag filtering
- [ ] Public API for developers
- [ ] Advanced analytics and insights
- [ ] Plugin recommendations
- [ ] User favorites and collections

---

## 📝 Version History

### v0.6.0 - Minecraft Support
- Added Minecraft mod and plugin support via multiple APIs
- Added Modrinth API integration for Fabric, Forge, and Quilt mods
- Added Spiget API integration for Spigot, Paper, and Bukkit server plugins
- Added CurseForge API integration for additional mods (requires API key)
- Added Minecraft-specific metadata (mod types, loaders, Minecraft versions)
- Updated data fetching scripts and documentation
- Expanded multi-platform ecosystem with gaming mods

### v0.5.0 - Sublime Text Support
- Added Sublime Text package support via Package Control API
- Added Sublime Text packages with GitHub repository detection
- Updated data fetching scripts and documentation
- Expanded multi-platform ecosystem

### v0.4.0 - WordPress Support
- Added WordPress plugin support via WordPress.org API
- Added 60,000+ WordPress plugins with pagination support
- Enhanced GitHub repository detection from plugin homepages
- Updated data fetching scripts and documentation
- Expanded multi-platform ecosystem

### v0.3.0 - Home Assistant Support
- Added Home Assistant component support via HACS default repository
- Added 2,389+ Home Assistant components across 7 categories
- Updated data fetching scripts and documentation
- Enhanced multi-platform support

### v0.2.0 - Multi-Platform Support & Export
- Added multi-platform support with platform filter
- Added export functionality (JSON, SQL, CSV)
- Added platform badges on plugin cards
- Enhanced UI with platform-specific colors
- Updated documentation

### v0.1.0 - Initial Release
- Next.js 14 application with TypeScript
- Obsidian plugin data fetching
- Search and filter functionality
- Responsive grid layout
- Dark mode support
- Vercel deployment

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

Created by [@seckinalp](https://github.com/seckinalp)

---

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) - For the amazing plugin ecosystem
- [Home Assistant](https://www.home-assistant.io/) - For the incredible automation platform and HACS
- [WordPress](https://wordpress.org/) - For the massive plugin ecosystem and open-source platform
- [Modrinth](https://modrinth.com/) - For the modern Minecraft mod platform
- [Spiget](https://spiget.org/) - For the SpigotMC plugin API
- [CurseForge](https://www.curseforge.com/) - For the comprehensive mod collection
- [Next.js](https://nextjs.org/) - For the incredible framework
- The open-source community - For inspiration and support

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/seckinalp/oss-plugin-hub/issues)
- **Feature Requests**: [Submit a request](https://github.com/seckinalp/oss-plugin-hub/issues/new)
- **Questions**: Open a discussion or issue

---

<div align="center">
  <strong>Happy plugin discovering! 🔌</strong>
  <br>
  <br>
  Made with ❤️ by the open-source community
</div>
