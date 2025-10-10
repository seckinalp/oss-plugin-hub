# Plugin Discovery Hub

A modern web application for discovering and exploring open-source plugins, starting with Obsidian.

## Features

- 🔍 Browse and search Obsidian plugins
- 📊 Filter by categories, authors, and more
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

## Development Roadmap

See [roadmap.md](./roadmap.md) for the detailed development plan.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel/Netlify/GitHub Pages

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
