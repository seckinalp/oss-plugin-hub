# Quick Start Guide

Get your Plugin Discovery Hub up and running in minutes!

## 📋 Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- npm (comes with Node.js)
- Git

## 🚀 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/oss-plugin-hub.git
   cd oss-plugin-hub
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Fetch plugin data**:
   ```bash
   npm run fetch-plugins
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - You should see the Plugin Discovery Hub!

## 📦 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run fetch-plugins` | Fetch latest plugin data |
| `npm run generate-rss` | Generate RSS feed |
| `npm run update-data` | Fetch plugins + generate RSS |

## 🎯 What's Included

✅ **Modern Tech Stack**:
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Responsive design with dark mode

✅ **Core Features**:
- Browse plugins across multiple platforms
- Platform filtering (Obsidian, VS Code, etc.)
- Real-time search and filtering
- Sort by name or author
- Export as JSON, SQL, or CSV
- Beautiful, modern UI

✅ **Automation**:
- Daily data updates via GitHub Actions
- RSS feed for new plugins
- Automatic deployments

## 🌐 Deployment

Deploy to Vercel:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Or use the Vercel Dashboard to import from GitHub. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

🌐 **Live Example**: [https://oss-plugin-hub.vercel.app/](https://oss-plugin-hub.vercel.app/)

## 🔄 Keeping Data Updated

### Manual Update
```bash
npm run update-data
git add data/ public/
git commit -m "chore: update plugin data"
git push
```

### Automatic Updates
Push your code to GitHub - the GitHub Action will:
- Run daily at 00:00 UTC
- Fetch new plugins
- Generate RSS feed
- Auto-commit and deploy

## 📡 RSS Feed

After deployment, users can subscribe to updates:
- Feed URL: `https://oss-plugin-hub.vercel.app/rss.xml`

## 🛠️ Using the App

### Search Plugins
- Use the search bar to find plugins by name, author, or description
- Search updates in real-time as you type

### Filter by Platform
- Click platform buttons to filter (e.g., "Obsidian", "VS Code")
- Click "All Platforms" to see everything
- Plugin count shown for each platform

### Export Data
After filtering/searching:
1. See the export section at the top
2. Choose your format:
   - **JSON** - For JavaScript/API usage
   - **SQL** - For database import
   - **CSV** - For Excel/spreadsheets
3. File downloads automatically
4. Only exports your filtered results!

### Sort Results
- Use the "Sort by" dropdown
- Choose "Name" (A-Z) or "Author"

## 🎨 Customization

### Change Site Title
Edit `app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: "Your Custom Title",
  description: "Your custom description",
};
```

### Modify Colors
Edit `tailwind.config.ts` to customize the color scheme.

### Add New Features
See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## ❓ Troubleshooting

**No plugins showing?**
- Run `npm run fetch-plugins`
- Check that `data/plugins.json` exists

**Build errors?**
- Clear cache: `rm -rf .next node_modules`
- Reinstall: `npm install`

**Port 3000 already in use?**
- Run on different port: `npm run dev -- -p 3001`

**Export not working?**
- Make sure you have plugins filtered/displayed
- Check browser console for errors
- Try a different browser

## 📚 Next Steps

1. ⭐ Star the repository
2. 🚀 Deploy your instance
3. 📢 Share with the community
4. 🤝 Contribute improvements
5. 📖 Read the full [README.md](./README.md)

## 💡 Tips

- Export feature works with any filter/search combination
- Exports only what you see on screen (filtered results)
- JSON format is great for APIs
- SQL format includes CREATE TABLE statement
- CSV format opens in Excel/Google Sheets
- Use platform filters to export platform-specific data

## 🆘 Need Help?

- 📖 Read [DEPLOYMENT.md](./DEPLOYMENT.md)
- 🐛 [Report an issue](https://github.com/your-username/oss-plugin-hub/issues)
- 💬 Start a [discussion](https://github.com/your-username/oss-plugin-hub/discussions)

---

Happy plugin discovering! 🎉

Created by [@seckinalp](https://github.com/seckinalp)
