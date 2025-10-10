# Vercel Environment Variables Setup

Quick guide for setting up environment variables in Vercel for the Plugin Discovery Hub.

## 🎯 Required Environment Variables

For the current version (Phase 1), you only need:

| Variable | Required | Purpose |
|----------|----------|---------|
| `SITE_URL` | Optional | Used in RSS feed URLs (defaults to Vercel URL) |
| `GH_TOKEN` | Phase 2 | GitHub API access for repository stats |

## 📝 Step-by-Step: Add `GH_TOKEN` to Vercel

### 1. Get Your GitHub Token

First, create a GitHub Personal Access Token:

1. Visit: https://github.com/settings/tokens/new
2. Fill in:
   - **Note:** `oss-plugin-hub-vercel`
   - **Expiration:** Your choice (90 days recommended)
   - **Scopes:** Check only `public_repo`
3. Click "Generate token"
4. **COPY THE TOKEN** (starts with `ghp_`) - you won't see it again!

### 2. Add to Vercel Dashboard

**Method 1: Via Web Interface (Recommended)**

1. Go to: https://vercel.com/dashboard
2. Select your project: **oss-plugin-hub**
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)
5. Click **Add New**
6. Fill in:
   ```
   Key: GH_TOKEN
   Value: ghp_your_token_here
   ```
7. Select environments:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
8. Click **Save**

**Method 2: Via Vercel CLI**

If you have Vercel CLI installed:

```bash
# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variable
vercel env add GH_TOKEN

# Paste your token when prompted
# Select: Production, Preview, Development (all)
```

### 3. Redeploy

After adding the variable, you need to redeploy:

**Option A: Via Dashboard**
1. Go to **Deployments** tab
2. Click "..." on the latest deployment
3. Click "Redeploy"

**Option B: Push new commit**
```bash
git add .
git commit -m "chore: add GitHub token support"
git push
```

**Option C: Via CLI**
```bash
vercel --prod
```

## ✅ Verify Setup

Check if the environment variable is set:

1. Go to **Settings** → **Environment Variables**
2. You should see:
   ```
   GH_TOKEN    •••••••••    Production, Preview, Development
   ```

The dots (•••) mean the variable is set and hidden for security.

## 🔒 Security Notes

### DO:
- ✅ Use environment variables for tokens
- ✅ Set expiration dates on tokens
- ✅ Use minimal scopes (`public_repo` only)
- ✅ Regenerate if compromised

### DON'T:
- ❌ Commit tokens to Git
- ❌ Share tokens publicly
- ❌ Use `GITHUB_TOKEN` as the name (reserved)
- ❌ Give unnecessary permissions

## 🚨 Common Issues

### "Variable not found in production"
**Solution:** Make sure you selected "Production" environment when adding

### Token not working
**Solution:**
1. Check token hasn't expired
2. Verify `public_repo` scope is selected
3. Try regenerating the token

### Builds failing after adding token
**Solution:** Redeploy - existing deployments don't get new env vars automatically

### "Secret name cannot start with GITHUB_"
**Solution:** Use `GH_TOKEN` not `GITHUB_TOKEN`

## 📊 Current Setup

For your live site at https://oss-plugin-hub.vercel.app/, the environment variables should be:

| Variable | Value | Set? |
|----------|-------|------|
| `SITE_URL` | `https://oss-plugin-hub.vercel.app` | Optional (auto-detected) |
| `GH_TOKEN` | `ghp_...` | ✅ Set this for Phase 2 |

## 🔄 Token Rotation

When your token expires:

1. **Create new token** (same steps as above)
2. **Update in Vercel:**
   - Settings → Environment Variables
   - Click **Edit** on `GH_TOKEN`
   - Paste new token
   - Save
3. **Update in GitHub Secrets:**
   - Repository Settings → Secrets → Actions
   - Edit `GH_TOKEN` secret
   - Paste new token
   - Save
4. **Redeploy** to apply changes

## 📖 Related Documentation

- [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md) - Detailed token setup guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [ROADMAP_DETAILED.md](./ROADMAP_DETAILED.md) - Phase 2 implementation

## 💡 Pro Tips

1. **Use descriptive names** when creating tokens so you know what they're for
2. **Set calendar reminders** before token expiration
3. **Use separate tokens** for different projects
4. **Monitor usage** in GitHub settings
5. **Rotate regularly** even if not expired (security best practice)

## ⚡ Quick Commands

```bash
# View environment variables
vercel env ls

# Pull environment variables to local
vercel env pull

# Remove environment variable
vercel env rm GH_TOKEN

# Add environment variable
vercel env add GH_TOKEN
```

---

Need help? Check the [full documentation](./GITHUB_TOKEN_SETUP.md) or open an issue.

Created by [@seckinalp](https://github.com/seckinalp)

