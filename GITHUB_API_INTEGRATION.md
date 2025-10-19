# GitHub API Comprehensive Data Integration

## Overview
This document describes the comprehensive GitHub API data integration implemented for the OSS Plugin Hub. The implementation fetches and displays extensive repository information on plugin detail pages.

## Data Collected from GitHub API

### 1. Foundational Metadata (from `/repos/{owner}/{repo}`)
- **Core Identity**: Plugin name, repository name, description, homepage, topics/tags
- **Ownership**: Owner name and type (Organization or User)
- **Popularity Metrics**: Stars, forks, watchers counts
- **License Information**: SPDX identifier
- **Repository Details**: Size, default branch, archived status, disabled status, has wiki, has pages

### 2. Release Information (from `/repos/{owner}/{repo}/releases`)
- **Release Count**: Total number of releases
- **Current Version**: Latest release tag name
- **Latest Release Date**: When the most recent release was published
- **Release Details**: Name, tag, URL, and release notes

### 3. Contributors (from `/repos/{owner}/{repo}/contributors`)
- **Total Contributors**: Count of all contributors
- **Top Contributors**: Top 5 contributors with:
  - Username
  - Contribution count
  - Avatar URL
  - Profile link

### 4. Commit Activity (from `/repos/{owner}/{repo}/stats/commit_activity`)
- **Total Commits**: Sum of commits over the last 52 weeks
- **Commit Frequency**: Average commits per week
- **Recent Activity**: Commit counts for the last 4 weeks (visualized as a bar chart)

### 5. Language Distribution (from `/repos/{owner}/{repo}/languages`)
- **Language Breakdown**: Bytes of code per programming language
- **Percentage Distribution**: Visual representation with progress bars

### 6. Issue and Pull Request Counts
- **Open Issues**: Current open issue count (from main repo endpoint)
- **Closed Issues**: Total closed issues (from Search API)
- **Open Pull Requests**: Current open PR count (from Search API)
- **Closed Pull Requests**: Total merged/closed PRs (from Search API)

### 7. Governance Files (from Contents API)
- **Contributing Guide**: Checks for `CONTRIBUTING.md`
- **Code of Conduct**: Checks for `CODE_OF_CONDUCT.md`
- **Security Policy**: Checks for `SECURITY.md`
- **License File**: Checks for `LICENSE` or `LICENSE.md`

### 8. Dependencies (from `package.json`)
- **Production Dependencies**: List with versions
- **Dev Dependencies**: List with versions
- **Peer Dependencies**: List with versions
- **Build Scripts**: Identifies build and compile scripts

### 9. CI/CD Workflows (from `.github/workflows/`)
- **Has Workflows**: Boolean indicating presence
- **Workflow Count**: Number of workflow files (.yml, .yaml)

### 10. Sponsorship Information (from `FUNDING.yml`)
- **Funding Links**: Parsed funding platforms and URLs
- **Supported Platforms**: 
  - GitHub Sponsors
  - Patreon
  - Open Collective
  - Ko-fi
  - Tidelift
  - Custom URLs

## Implementation Details

### Type Definitions (`types/plugin.ts`)
Added comprehensive interfaces for all GitHub data:
- `Contributor`: Contributor information
- `Release`: Release details
- `LanguageDistribution`: Language breakdown
- `GovernanceFiles`: Governance file flags
- `Dependencies`: Dependency objects
- `CommitActivity`: Commit statistics
- `FundingLink`: Sponsorship links
- Enhanced `GitHubStats`: Comprehensive stats interface

### Utility Functions (`utils/github.ts`)
Created modular functions for fetching each data type:
- `fetchReleases()`: Get release information
- `fetchContributors()`: Get contributor data
- `fetchCommitActivity()`: Get commit statistics
- `fetchLanguageDistribution()`: Get language breakdown
- `fetchGovernance()`: Check for governance files
- `fetchDependencies()`: Parse package.json
- `fetchWorkflows()`: Check CI/CD workflows
- `fetchFunding()`: Parse FUNDING.yml
- `fetchClosedIssuesCount()`: Get closed issue count
- `fetchPRCounts()`: Get PR statistics
- Enhanced `fetchRepoStats()`: Main function with `comprehensive` flag

### Update Script (`scripts/update-github-stats.js`)
Enhanced the script to:
- Fetch all comprehensive data in parallel for efficiency
- Handle rate limiting gracefully
- Include error handling for each data source
- Support partial data (some sources may fail without breaking the whole fetch)

### Plugin Detail Page (`app/plugin/[id]/page.tsx`)
Created beautiful, organized sections displaying:

1. **Repository Statistics**
   - Primary metrics: Stars, Forks, Open Issues, Watchers
   - Secondary metrics: Closed Issues, Open/Closed PRs, Contributors

2. **Latest Release**
   - Version information
   - Release date (relative time)
   - Link to release page
   - Total release count

3. **Top Contributors**
   - Avatar and username
   - Contribution count
   - Link to profile
   - Interactive hover effects

4. **Commit Activity**
   - Total commits (52 weeks)
   - Average commits per week
   - Visual bar chart of recent 4 weeks

5. **Language Distribution**
   - Percentage breakdown
   - Progress bars for each language
   - Sorted by usage

6. **Dependencies**
   - Production dependencies (limited to 10 shown)
   - Dev dependencies (limited to 10 shown)
   - Count indicators
   - Color-coded badges

7. **Repository Health**
   - Governance file indicators (✅/❌)
   - License status
   - Contributing guide
   - Code of conduct
   - Security policy
   - CI/CD workflows with count

8. **Funding Links** (Sidebar)
   - All detected funding platforms
   - Direct links to sponsor pages

## Usage

### Running the Update Script
```bash
# With GitHub token (recommended)
GH_TOKEN=your_github_token node scripts/update-github-stats.js

# Without token (rate limited)
node scripts/update-github-stats.js
```

### Fetching Comprehensive Stats
The plugin detail page automatically fetches comprehensive stats if they're not already in the data file:

```typescript
const stats = await fetchRepoStats(owner, repo, true); // true = comprehensive
```

### Rate Limit Considerations
- **Authenticated**: 5,000 requests/hour per token
- **Unauthenticated**: 60 requests/hour

The comprehensive fetch makes approximately 10-12 API calls per repository:
1. Main repo endpoint
2. Releases
3. Contributors
4. Commit activity
5. Languages
6. Governance files (4 checks)
7. Package.json
8. Workflows
9. Funding.yml
10. Closed issues (search)
11. PR counts (2 searches)

## Benefits

1. **Comprehensive Insights**: Users get complete repository information at a glance
2. **Informed Decisions**: Health indicators help users evaluate plugin quality
3. **Community Visibility**: Contributor recognition and sponsorship support
4. **Development Activity**: Commit activity shows project health
5. **Technical Details**: Dependencies and CI/CD provide technical context
6. **Modern UI**: Beautiful, organized presentation with dark mode support

## Future Enhancements

Potential additions:
- Download statistics (if available)
- Code coverage metrics (from badges)
- Issue response time analysis
- Community metrics (issue/PR close time)
- Dependency vulnerability scanning
- Historical trend charts

## API Endpoints Reference

| Data Type | Endpoint | Rate |
|-----------|----------|------|
| Repository | `/repos/{owner}/{repo}` | 1 |
| Releases | `/repos/{owner}/{repo}/releases` | 1 |
| Contributors | `/repos/{owner}/{repo}/contributors` | 1 |
| Commit Activity | `/repos/{owner}/{repo}/stats/commit_activity` | 1 |
| Languages | `/repos/{owner}/{repo}/languages` | 1 |
| File Contents | `/repos/{owner}/{repo}/contents/{path}` | ~5 |
| Search Issues | `/search/issues?q=...` | 3 |

**Total API calls per plugin**: ~13 requests

