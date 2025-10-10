Project Roadmap: Plugin Discovery Hub
This document outlines the development plan for the Plugin Discovery Hub. The project is divided into distinct phases, starting with a Minimum Viable Product (MVP) focused on Obsidian and progressively expanding to include more platforms and advanced features.

## Phase 1: Foundation & Obsidian MVP ✅ COMPLETED
The primary goal of this phase is to launch a functional web application that successfully aggregates and displays open-source plugins for Obsidian.

[✓] Initial Scaffolding: Set up the project structure, version control, and basic dependencies.

[✓] Data Fetching Script: Create a script to fetch the community-plugins.json from the official Obsidian GitHub repository.   

[✓] Basic Frontend UI: Develop a clean, responsive web interface to display the list of plugins in a searchable and filterable table or grid.

[✓] Search & Filter: Implement basic client-side search by plugin name, author, and description.

[✓] Update Notifications: Implement a system to compare daily data fetches and generate an rss.xml feed to notify users of newly added plugins.

[✓] CI/CD Automation: Set up a GitHub Action to run the data-fetching script on a daily schedule, ensuring the database is always up-to-date.

[✓] Initial Deployment: Deploy the static site to Vercel.

[✓] Multi-Platform Support: Add platform filtering and badges for future platform expansion.

[✓] Export Functionality: Add JSON, SQL, and CSV export capabilities.

## Phase 2: GitHub API Integration & Enhanced Metrics ✅ COMPLETED
Enhance the plugin data with real-time GitHub repository statistics and advanced filtering capabilities.

[✓] GitHub API Integration: Created GitHub API utility functions and update script
  - Star count, fork count, open issues
  - Last commit date, creation date
  - License, homepage, topics, language
  - Repository size and status (archived/disabled)

[✓] Advanced Filtering & Sorting: Added UI controls for advanced plugin discovery:
  - Sort by "Most Stars", "Most Forks"
  - Sort by "Recently Updated", "Newest"
  - Filter by minimum stars
  - Advanced filters panel

[✓] Plugin Detail Pages: Created dedicated `/plugin/[id]` pages with:
  - Repository statistics (stars, forks, issues, watchers)
  - Rendered README.md content with GitHub Flavored Markdown
  - Health status indicators (Active/Maintained/Stale/Inactive)
  - Platform badges and metadata
  - Links to GitHub, homepage, and funding
  - Topics/tags display

[✓] GitHub API Client: Implemented rate limit checking and error handling

[✓] Health Indicators: Visual status badges based on last update date
  - Active (< 30 days)
  - Maintained (< 180 days)
  - Stale (< 365 days)
  - Inactive (> 365 days)

## Phase 3: Multi-Platform Expansion (Future)
Expand plugin discovery to additional development platforms.

[ ] VS Code Extensions: Add support for Visual Studio Code marketplace plugins.

[ ] JetBrains Plugins: Add support for JetBrains marketplace (IntelliJ, PyCharm, WebStorm, etc.).

[ ] Additional Platforms: Sublime Text, Vim/Neovim, Atom, and other platforms.

## Phase 4: Advanced Features (Future)
Additional features to enhance plugin discovery and analysis.

[ ] Plugin Comparison Tool: Side-by-side comparison of multiple plugins.

[ ] Trending Dashboard: Show trending and popular plugins based on GitHub metrics.

[ ] Category System: Organize plugins by categories and tags.

[ ] Developer API: Provide REST API for developers to access plugin data.

[ ] Analytics: Advanced insights and statistics about the plugin ecosystem.