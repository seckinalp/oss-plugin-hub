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

## Phase 2: GitHub API Integration & Enhanced Metrics (Planned)
Enhance the plugin data with real-time GitHub repository statistics and advanced filtering capabilities.

[ ] GitHub API Integration: Enhance the data-fetching script to query the GitHub API for each plugin's repository to retrieve metrics like:
  - Star count
  - Fork count
  - Date of the last commit
  - Open issues count
  - Contributors count
  - License information

[ ] Advanced Filtering & Sorting: Add UI controls to sort and filter plugins based on the new GitHub metrics:
  - Sort by "Most Stars"
  - Sort by "Recently Updated"
  - Sort by "Most Forks"
  - Filter by minimum stars
  - Filter by last update date
  - Filter by license type

[ ] Plugin Detail Pages: Create dedicated pages for each plugin, providing:
  - Comprehensive plugin overview
  - Rendered README.md content
  - Repository statistics and charts
  - Activity graph (commits over time)
  - Link to official documentation
  - Installation instructions

[ ] Rate Limiting & Caching: Implement GitHub API rate limit handling and response caching to optimize API usage.

[ ] Performance Metrics: Add visual indicators for plugin health (maintained vs. abandoned).