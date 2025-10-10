# Plugin Discovery Hub

A modern web application for discovering and exploring open-source plugins across multiple platforms, starting with Obsidian.

🌐 **Live Site**: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

## Features

- 🔍 Browse and search plugins across multiple platforms
- 🎯 Filter by platform (Obsidian, VS Code, JetBrains, and more)
- 📊 Sort by name or author
- 📥 Export filtered results as JSON, SQL, or CSV
- 🔔 RSS feed for new plugin notifications
- 🌙 Dark mode support
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Fetch Plugin Data

```bash
# Fetch latest plugin data from Obsidian repository
npm run fetch-plugins
```

## Project Structure

```
oss-plugin-hub/
├── app/              # Next.js app directory
├── components/       # React components
├── data/            # Plugin data storage
├── scripts/         # Data fetching and processing scripts
├── public/          # Static assets
└── types/           # TypeScript type definitions
```

## Documentation

- 📖 **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
- 🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy to Vercel
- ⚙️ **[VERCEL_SETUP.md](./VERCEL_SETUP.md)** - Vercel environment variables setup
- 🔑 **[GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)** - GitHub token setup (for Phase 2)
- 🤝 **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- ➕ **[ADDING_PLATFORMS.md](./ADDING_PLATFORMS.md)** - Add new platforms
- 📥 **[EXPORT_GUIDE.md](./EXPORT_GUIDE.md)** - Export data guide
- 📋 **[CHANGELOG.md](./CHANGELOG.md)** - Version history

## Development Roadmap

- **Phase 1 (MVP)** ✅ Completed - Basic plugin discovery with search, filter, export
- **Phase 2 (Planned)** 🔜 GitHub API integration, advanced metrics, detail pages
- **Phase 3 (Future)** Multi-platform expansion (VS Code, JetBrains, etc.)
- **Phase 4 (Future)** Advanced features (comparisons, trending, analytics, API)

See [roadmap.md](./roadmap.md) for the high-level plan and [ROADMAP_DETAILED.md](./ROADMAP_DETAILED.md) for detailed implementation specs.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Supported Platforms

- ✅ **Obsidian** - Currently supported (2,636+ plugins)
- 🔜 **VS Code** - Ready to add
- 🔜 **JetBrains** - Ready to add
- 🔜 **Sublime Text** - Ready to add
- 🔜 **More platforms** - Submit a request!

The app is designed to support multiple platforms! See [ADDING_PLATFORMS.md](./ADDING_PLATFORMS.md) to learn how to add a new platform.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Want to add a new platform?** Check out [ADDING_PLATFORMS.md](./ADDING_PLATFORMS.md) for a step-by-step guide.

## Author

Created by [@seckinalp](https://github.com/seckinalp)

## License

MIT
