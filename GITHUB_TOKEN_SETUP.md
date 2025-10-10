# GitHub Personal Access Token Setup

This guide shows you how to create and configure a GitHub Personal Access Token for the Plugin Discovery Hub (Phase 2 features).

## Why Do You Need This?

For **Phase 2** features, the app fetches GitHub repository statistics:
- ⭐ Stars, 🍴 Forks, 🐛 Issues
- 📅 Last commit date
- 📜 License information
- And more...

Without a token, you're limited to 60 API requests/hour. With a token, you get 5,000 requests/hour.

## Step 1: Create a Personal Access Token

1. Go to **GitHub Settings**:
   - https://github.com/settings/tokens
   - Or: Click your profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. Click **"Generate new token"** → **"Generate new token (classic)"**

3. **Configure the token:**
   - **Note:** `oss-plugin-hub-api`
   - **Expiration:** Choose your preference (90 days, 1 year, or no expiration)
   - **Scopes:** Select only:
     - ✅ `public_repo` (Access public repositories)
   
   ⚠️ **Important:** Don't select any other scopes. You only need read access to public repos.

4. Click **"Generate token"**

5. **Copy the token immediately!** (starts with `ghp_`)
   - You won't be able to see it again
   - Save it somewhere safe temporarily

## Step 2: Add to Vercel

1. Go to your Vercel project:
   - https://vercel.com/dashboard
   - Select your project

2. Go to **Settings** → **Environment Variables**

3. Add a new variable:
   - **Name:** `GH_TOKEN`
   - **Value:** Paste your token (starts with `ghp_`)
   - **Environment:** Production, Preview, Development (select all)
   
4. Click **"Save"**

## Step 3: Add to GitHub Secrets (for Actions)

1. Go to your GitHub repository:
   - https://github.com/your-username/oss-plugin-hub

2. Go to **Settings** → **Secrets and variables** → **Actions**

3. Click **"New repository secret"**

4. Add the secret:
   - **Name:** `GH_TOKEN`
   - **Value:** Paste your token (starts with `ghp_`)

5. Click **"Add secret"**

## Important Notes

### ✅ DO:
- Use the name `GH_TOKEN` or `PERSONAL_ACCESS_TOKEN`
- Keep your token secure and private
- Use minimal scopes (`public_repo` only)
- Regenerate if compromised
- Set an expiration date for security

### ❌ DON'T:
- Don't use `GITHUB_TOKEN` as the secret name (reserved by GitHub)
- Don't commit the token to your repository
- Don't share the token publicly
- Don't give unnecessary permissions

## Verify It Works

After adding the token, you can verify it works:

### Test Locally:
```bash
# Set environment variable (Windows PowerShell)
$env:GH_TOKEN = "your_token_here"

# Test the API
node -e "fetch('https://api.github.com/rate_limit', {headers: {'Authorization': 'token ' + process.env.GH_TOKEN}}).then(r => r.json()).then(console.log)"
```

You should see:
```json
{
  "resources": {
    "core": {
      "limit": 5000,  // <-- With token
      "remaining": 4999,
      "reset": ...
    }
  }
}
```

Without a token, the limit would be 60.

## Rate Limits

| Type | Requests/Hour | Use Case |
|------|---------------|----------|
| **No Token** | 60 | Testing only |
| **With Token** | 5,000 | Production use |

For 2,636 Obsidian plugins, you need ~2,636 API calls to fetch all stats. With a token, you can easily fetch all data daily.

## Troubleshooting

### "Bad credentials" error
- Token is incorrect or expired
- Regenerate the token

### "API rate limit exceeded"
- You've hit the hourly limit
- Wait for the reset time
- Implement caching (see ROADMAP_DETAILED.md)

### "Not Found" errors
- Token doesn't have correct permissions
- Make sure `public_repo` scope is selected

### GitHub Actions failing
- Secret name can't start with `GITHUB_`
- Use `GH_TOKEN` instead

## Security Best Practices

1. **Rotate tokens regularly** (every 90 days)
2. **Use separate tokens** for different environments
3. **Revoke unused tokens** at https://github.com/settings/tokens
4. **Monitor token usage** in GitHub settings
5. **Never log tokens** in your application

## Next Steps

Once configured:
1. ✅ Token added to Vercel
2. ✅ Token added to GitHub Secrets
3. 🔜 Implement Phase 2 features
4. 🔜 Test with live API data

See **ROADMAP_DETAILED.md** for implementation details.

---

Created by [@seckinalp](https://github.com/seckinalp)

