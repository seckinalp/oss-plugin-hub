# Deployment Guide

This guide covers deploying the Plugin Discovery Hub to various hosting platforms.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git repository on GitHub

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the easiest deployment experience for Next.js applications.

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy via Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js configuration
   - Click "Deploy"

3. **Environment Variables** (optional):
   - Set `SITE_URL` to your production URL in Vercel dashboard

4. **Automatic Deployments**:
   - Vercel automatically deploys on every push to main branch
   - Preview deployments for pull requests

### Option 2: Netlify

1. **Connect Repository**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

2. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `out`
   - Node version: 20

3. **Deploy**:
   - Click "Deploy site"

### Option 3: GitHub Pages

GitHub Pages deployment is configured via GitHub Actions.

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"

2. **Configure Base Path** (if using project page):
   
   Update `next.config.mjs`:
   ```javascript
   const nextConfig = {
     output: 'export',
     basePath: '/your-repo-name',  // Add this line
     images: {
       unoptimized: true,
     },
   };
   ```

3. **Push to Main Branch**:
   - The deploy workflow will automatically run
   - Site will be available at `https://username.github.io/repo-name`

## Post-Deployment Setup

### 1. Initial Data Fetch

After deployment, fetch the plugin data:

```bash
npm run fetch-plugins
npm run generate-rss
```

Then commit and push the data files:

```bash
git add data/plugins.json public/rss.xml
git commit -m "chore: add initial plugin data"
git push
```

### 2. Enable Automated Updates

The GitHub Action workflow will automatically:
- Fetch new plugin data daily at 00:00 UTC
- Generate updated RSS feed
- Commit changes and trigger redeployment

No additional setup required!

### 3. Configure Site URL

Set the `SITE_URL` environment variable in your hosting platform:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables  
- **GitHub Pages**: Repository Settings → Secrets → Actions → New secret

Example: `SITE_URL=https://plugin-hub.vercel.app`

## RSS Feed

After deployment, your RSS feed will be available at:
- `https://your-domain.com/rss.xml`

Users can subscribe to this feed to get notifications of new plugins.

## Troubleshooting

### Build Fails

1. Ensure Node.js version is 18+
2. Clear cache and reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Plugin Data Not Showing

1. Make sure `data/plugins.json` exists
2. Run the fetch script manually:
   ```bash
   npm run fetch-plugins
   ```
3. Check the file was committed to the repository

### GitHub Actions Not Running

1. Check Actions tab in GitHub repository
2. Ensure Actions are enabled in repository settings
3. Check for workflow errors in Actions logs

## Monitoring

- **Vercel**: Built-in analytics and deployment logs
- **Netlify**: Deploy logs and site analytics
- **GitHub Pages**: Check Actions tab for deployment status

## Updates

To manually trigger an update:

1. Go to Actions tab in GitHub
2. Select "Update Plugin Data" workflow
3. Click "Run workflow"

Or run locally and commit:
```bash
npm run update-data
git add data/ public/
git commit -m "chore: update plugin data"
git push
```

