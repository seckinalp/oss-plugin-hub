# Plugin Discovery Hub

A modern web application for discovering and exploring open-source plugins across multiple platforms, starting with Obsidian.

🌐 **Live Site**: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

## Features

- 🔍 Browse and search plugins across multiple platforms
- 🎯 Filter by platform (Obsidian, VS Code, JetBrains, and more)
- 📊 Sort by name or author
- 📥 Export filtered results as JSON, SQL, or CSV
- 🌙 Dark mode support
- 📱 Responsive design

## Usage

Simply visit the live site to browse and search plugins:

🌐 **[https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)**

No installation required - everything runs in your browser!

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

- 🤝 **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- 📋 **[CHANGELOG.md](./CHANGELOG.md)** - Version history

## Development Roadmap

- **Phase 1 (MVP)** ✅ Completed - Basic plugin discovery with search, filter, export
- **Phase 2** ✅ Completed - GitHub API integration, advanced metrics, detail pages
- **Phase 3 (Future)** 🔜 Multi-platform expansion (VS Code, JetBrains, etc.)
- **Phase 4 (Future)** Advanced features (comparisons, trending, analytics, API)

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

The app is designed to support multiple platforms! See [CONTRIBUTING.md](./CONTRIBUTING.md) for information on how to add a new platform.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Author

Created by [@seckinalp](https://github.com/seckinalp)

## License

MIT
