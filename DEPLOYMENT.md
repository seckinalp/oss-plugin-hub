# Deployment Guide - Vercel

This guide covers deploying the Plugin Discovery Hub to Vercel.

🌐 **Live Example**: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git repository on GitHub
- Vercel account ([sign up free](https://vercel.com))

## Deployment to Vercel

Vercel provides the easiest deployment experience for Next.js applications with automatic builds and deployments.

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration
   - Click "Deploy"

3. **Wait for deployment**:
   - First deployment takes 1-2 minutes
   - You'll get a live URL (e.g., `your-project.vercel.app`)

4. **Done!** 🎉
   - Your site is now live
   - Future pushes to `main` branch auto-deploy

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Follow the prompts**:
   - Link to existing project or create new one
   - Confirm settings
   - Wait for deployment

## Post-Deployment Setup

### 1. Initial Data Fetch

After deployment, you need to populate the plugin data:

```bash
# Fetch plugin data locally
npm run fetch-plugins
npm run generate-rss

# Commit and push
git add data/plugins.json data/plugins-previous.json public/rss.xml
git commit -m "chore: add initial plugin data"
git push
```

Vercel will automatically redeploy with the data.

### 2. Enable Automated Updates

The GitHub Action workflow will automatically:
- Fetch new plugin data daily at 00:00 UTC
- Generate updated RSS feed
- Commit changes and trigger Vercel redeployment

**Configure the site URL in GitHub Secrets:**

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `SITE_URL`
5. Value: `https://your-project.vercel.app`
6. Click "Add secret"

### 3. Custom Domain (Optional)

To use a custom domain:

1. Go to your Vercel project dashboard
2. Click "Settings" → "Domains"
3. Add your domain (e.g., `plugin-hub.com`)
4. Follow DNS configuration instructions
5. Vercel handles SSL automatically

## RSS Feed

After deployment, your RSS feed is available at:
- `https://your-project.vercel.app/rss.xml`

Users can subscribe to this feed to get notifications of new plugins.

## Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `SITE_URL` | `https://your-project.vercel.app` | Your site URL for RSS feed |
| `GH_TOKEN` | `ghp_xxxxxxxxxxxxx` | (Optional) GitHub Personal Access Token for API access |

**Note:** For Phase 2 GitHub API integration, you'll need a GitHub Personal Access Token. Don't name it `GITHUB_TOKEN` - that's reserved by GitHub. Use `GH_TOKEN` instead.

## Vercel Features

### Automatic Deployments
- ✅ Every push to `main` auto-deploys to production
- ✅ Pull requests get preview deployments
- ✅ Instant rollbacks available

### Performance
- ✅ Global CDN
- ✅ Automatic caching
- ✅ Edge network optimization
- ✅ Zero-config SSL

### Monitoring
- ✅ Built-in analytics
- ✅ Deployment logs
- ✅ Error tracking
- ✅ Performance insights

## Troubleshooting

### Build Fails

**Check build logs** in Vercel dashboard:
1. Go to Deployments
2. Click on failed deployment
3. Check "Building" logs

**Common issues:**
- Missing `data/plugins.json` → Run fetch-plugins and commit
- Node version mismatch → Vercel uses Node 18+ by default
- Build timeout → Contact Vercel support (rare)

### Plugin Data Not Showing

1. Ensure `data/plugins.json` exists in your repository
2. Run locally:
   ```bash
   npm run fetch-plugins
   git add data/
   git commit -m "Add plugin data"
   git push
   ```
3. Check Vercel deployment logs

### GitHub Actions Not Running

1. Enable Actions in repository settings
2. Check Actions tab for errors
3. Verify `SITE_URL` secret is set correctly
4. Check workflow file permissions

### RSS Feed Not Updating

1. Check if `public/rss.xml` exists
2. Run locally:
   ```bash
   npm run generate-rss
   git add public/rss.xml
   git push
   ```

## Manual Updates

To manually trigger a data update:

### Via GitHub Actions (Recommended)
1. Go to Actions tab in GitHub
2. Select "Update Plugin Data" workflow
3. Click "Run workflow"
4. Wait for completion
5. Vercel auto-deploys

### Via Local Machine
```bash
# Update data
npm run update-data

# Commit and push
git add data/ public/
git commit -m "chore: update plugin data"
git push
```

## Monitoring Your Site

### Vercel Analytics
- Go to your project → Analytics
- View page views, top pages, and more
- Free tier includes basic analytics

### Deployment Status
- Dashboard shows all deployments
- Green checkmark = successful
- Red X = failed (click for logs)

### GitHub Actions Status
- Actions tab shows workflow runs
- Email notifications for failures
- View logs for debugging

## Performance Tips

1. **Optimize Images**: Already configured with `unoptimized: true`
2. **Caching**: Vercel handles automatically
3. **CDN**: Global edge network included
4. **Compression**: Automatic gzip/brotli

## Costs

**Vercel Free Tier includes:**
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Automatic SSL
- ✅ Custom domains
- ✅ Preview deployments

**Sufficient for:**
- Personal projects
- Small to medium sites
- Thousands of monthly visitors

## Next Steps

1. ✅ Site deployed
2. ✅ Data populated
3. ✅ GitHub Actions configured
4. 📊 Monitor analytics
5. 🎨 Customize as needed
6. 🚀 Share with community!

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

---

**Your Plugin Discovery Hub is live! 🎉**

Visit: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)
