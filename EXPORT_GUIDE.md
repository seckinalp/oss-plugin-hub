# Export Guide

Learn how to export plugin data in different formats from the Plugin Discovery Hub.

## Overview

The export feature allows you to download filtered/searched plugin data in multiple formats:
- **JSON** - For APIs, JavaScript applications, data exchange
- **SQL** - For database imports (MySQL, PostgreSQL, SQLite)
- **CSV** - For spreadsheets (Excel, Google Sheets)

## How to Export

### Step 1: Filter Your Data

Use any combination of filters:

1. **Platform Filter**
   - Click platform buttons (e.g., "Obsidian", "VS Code")
   - Or select "All Platforms"

2. **Search**
   - Type in the search box
   - Search by name, author, or description

3. **Sort**
   - Choose "Name" or "Author" from dropdown

### Step 2: Export

After filtering, look for the export section at the top of the results:

```
Export 150 filtered plugins:  [JSON] [SQL] [CSV]
```

Click the format you need - the file downloads automatically!

## Export Formats

### JSON Format

**Best for:**
- API integration
- JavaScript applications
- Data exchange between systems
- Backup purposes

**Example Output:**
```json
[
  {
    "id": "obsidian-git",
    "name": "Obsidian Git",
    "author": "denolehov",
    "description": "Backup your vault with Git",
    "repo": "denolehov/obsidian-git",
    "platform": "obsidian",
    "branch": "master"
  },
  {
    "id": "dataview",
    "name": "Dataview",
    "author": "blacksmithgu",
    "description": "Complex data views",
    "repo": "blacksmithgu/obsidian-dataview",
    "platform": "obsidian"
  }
]
```

**Use Cases:**
- Import into another application
- Process with Node.js/Python scripts
- Store in NoSQL databases
- API responses

### SQL Format

**Best for:**
- MySQL databases
- PostgreSQL databases
- SQLite databases
- Relational database systems

**Example Output:**
```sql
-- SQL Export of 150 plugins
-- Generated on 2025-10-10T17:48:00.305Z

CREATE TABLE IF NOT EXISTS plugins (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  description TEXT,
  repo VARCHAR(255),
  platform VARCHAR(50) NOT NULL,
  branch VARCHAR(100),
  author_url VARCHAR(255),
  funding_url VARCHAR(255)
);

INSERT INTO plugins (id, name, author, description, repo, platform, branch, author_url, funding_url) VALUES
  ('obsidian-git', 'Obsidian Git', 'denolehov', 'Backup your vault with Git', 'denolehov/obsidian-git', 'obsidian', 'master', NULL, NULL),
  ('dataview', 'Dataview', 'blacksmithgu', 'Complex data views', 'blacksmithgu/obsidian-dataview', 'obsidian', NULL, NULL, NULL);
```

**Features:**
- Includes `CREATE TABLE` statement
- Proper SQL escaping
- Handles NULL values
- Ready to run

**Use Cases:**
- Import into MySQL/PostgreSQL
- Populate development databases
- Data analysis with SQL
- Create searchable plugin database

### CSV Format

**Best for:**
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Data analysis tools

**Example Output:**
```csv
id,name,author,description,repo,platform,branch,authorUrl,fundingUrl
"obsidian-git","Obsidian Git","denolehov","Backup your vault with Git","denolehov/obsidian-git","obsidian","master","",""
"dataview","Dataview","blacksmithgu","Complex data views","blacksmithgu/obsidian-dataview","obsidian","","",""
```

**Features:**
- Properly escaped fields
- Quoted fields with commas
- Header row included
- UTF-8 encoding

**Use Cases:**
- Create charts in Excel
- Data analysis in Google Sheets
- Import into CRM systems
- Share with non-technical users

## Common Use Cases

### 1. Export Obsidian Plugins Only

1. Click "Obsidian" platform filter
2. Click "JSON" or "SQL" export
3. Get all Obsidian plugins

**Result:** `plugins.json` or `plugins.sql` with only Obsidian plugins

### 2. Export Specific Author's Plugins

1. Search for author name (e.g., "denolehov")
2. Review filtered results
3. Click "CSV" to export
4. Open in Excel for analysis

**Result:** Spreadsheet with all plugins by that author

### 3. Create a Database of Top Plugins

1. Filter by platform
2. Sort by name or author
3. Click "SQL" export
4. Run SQL file in your database

```bash
mysql -u username -p database_name < plugins.sql
# or
psql -U username -d database_name -f plugins.sql
```

### 4. Backup All Plugin Data

1. Select "All Platforms"
2. Don't apply any filters
3. Click "JSON" export
4. Save as backup

**Result:** Complete backup of all plugins in JSON format

### 5. Create Custom Plugin Lists

1. Search for keywords (e.g., "markdown", "notes")
2. Review and filter results
3. Export as CSV
4. Share with team via Google Sheets

## Tips & Tricks

### Tip 1: Export is Smart
The export always exports **only what you see**:
- If you filter to 10 plugins, you export 10 plugins
- If you search and get 5 results, you export 5 results
- If you show all 2,636 plugins, you export all 2,636

### Tip 2: File Naming
Files are automatically named:
- JSON: `plugins.json`
- SQL: `plugins.sql`
- CSV: `plugins.csv`

### Tip 3: Multiple Exports
You can export the same filtered data in different formats:
1. Apply your filters
2. Click JSON (downloads)
3. Click SQL (downloads)
4. Click CSV (downloads)

All three files contain the same data in different formats!

### Tip 4: Platform-Specific Exports
Export data for each platform separately:
1. Click "Obsidian" → Export JSON → Save as `obsidian.json`
2. Click "VS Code" → Export JSON → Save as `vscode.json`
3. Etc.

### Tip 5: SQL Import
After exporting SQL:

**MySQL:**
```bash
mysql -u root -p your_database < plugins.sql
```

**PostgreSQL:**
```bash
psql -U postgres -d your_database -f plugins.sql
```

**SQLite:**
```bash
sqlite3 plugins.db < plugins.sql
```

## Advanced Usage

### Combining with APIs

Use JSON export to seed your own API:

```javascript
// Load exported data
const plugins = require('./plugins.json');

// Create API endpoint
app.get('/api/plugins', (req, res) => {
  res.json(plugins);
});
```

### Data Analysis with Python

```python
import json
import pandas as pd

# Load JSON export
with open('plugins.json', 'r') as f:
    plugins = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(plugins)

# Analyze
print(df['platform'].value_counts())
print(df.groupby('author').size().sort_values(ascending=False).head(10))
```

### Excel Analysis

1. Export as CSV
2. Open in Excel
3. Create Pivot Tables
4. Generate charts
5. Filter and analyze

## Troubleshooting

**Export button not showing?**
- Make sure you have plugins displayed (not empty results)
- Check if filters are too restrictive

**File not downloading?**
- Check browser download settings
- Try a different browser
- Check for popup blockers

**Special characters in SQL?**
- SQL export properly escapes quotes and special characters
- Safe to import directly

**CSV opens incorrectly in Excel?**
- Try importing via "Data" → "From Text/CSV"
- Choose UTF-8 encoding
- Use comma as delimiter

## Examples

### Example 1: Create a Plugin Comparison Sheet

1. Search for "markdown"
2. Export as CSV
3. Open in Google Sheets
4. Add columns for ratings, personal notes
5. Share with team

### Example 2: Build a Plugin Recommendation System

1. Export all plugins as JSON
2. Load into recommendation engine
3. Analyze descriptions and authors
4. Generate recommendations

### Example 3: Create a Plugin Directory Website

1. Export all plugins as JSON
2. Use as data source for static site
3. Build with Next.js/Gatsby
4. Deploy your own plugin directory

### Example 4: Database for Plugin Search

1. Export as SQL
2. Import into PostgreSQL
3. Add full-text search indexes
4. Build search API

## Summary

The export feature gives you complete control over plugin data:

- ✅ Export exactly what you see
- ✅ Three formats for different use cases
- ✅ Instant downloads
- ✅ No limits on export size
- ✅ Works with all filters and searches

**Perfect for:**
- Developers building apps
- Data analysts
- Team sharing
- Personal backups
- Database imports
- Spreadsheet analysis

---

Created by [@seckinalp](https://github.com/seckinalp)

