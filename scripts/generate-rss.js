const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const PLUGINS_FILE = path.join(DATA_DIR, 'plugins.json');
const RSS_OUTPUT = path.join(__dirname, '../public/rss.xml');
const SITE_URL = process.env.SITE_URL || 'https://plugin-hub.example.com';
const MAX_ITEMS = 50; // Maximum number of items in RSS feed

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate RSS feed XML
 */
function generateRSS(newPlugins, lastUpdated) {
  const now = new Date(lastUpdated).toUTCString();
  
  let rssItems = '';
  
  // Sort by most recent first (assuming the order is already newest first)
  const itemsToInclude = newPlugins.slice(0, MAX_ITEMS);
  
  itemsToInclude.forEach(plugin => {
    const title = escapeXml(plugin.name);
    const author = escapeXml(plugin.author);
    const description = escapeXml(plugin.description);
    const repoUrl = `https://github.com/${escapeXml(plugin.repo)}`;
    const guid = `plugin-${escapeXml(plugin.id)}`;
    
    rssItems += `
    <item>
      <title>${title}</title>
      <link>${repoUrl}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${now}</pubDate>
      <author>${author}</author>
      <description>${description}</description>
      <category>Obsidian Plugin</category>
    </item>`;
  });

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Plugin Discovery Hub - New Plugins</title>
    <link>${SITE_URL}</link>
    <description>Stay updated with newly added Obsidian plugins</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return rssXml;
}

/**
 * Main function
 */
function main() {
  console.log('📡 Generating RSS feed...\n');

  try {
    // Check if plugin data exists
    if (!fs.existsSync(PLUGINS_FILE)) {
      console.error('❌ Plugin data file not found. Run fetch-plugins first.');
      process.exit(1);
    }

    // Load plugin data
    const pluginData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    const { plugins, lastUpdated, newPlugins: newPluginIds } = pluginData;

    // Get new plugins details
    const newPlugins = newPluginIds 
      ? plugins.filter(p => newPluginIds.includes(p.id))
      : [];

    console.log(`📝 Found ${newPlugins.length} new plugin(s) to include in RSS feed`);

    // Generate RSS XML
    const rssXml = generateRSS(newPlugins, lastUpdated);

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write RSS file
    fs.writeFileSync(RSS_OUTPUT, rssXml);
    console.log(`✓ RSS feed generated: ${RSS_OUTPUT}`);

    if (newPlugins.length > 0) {
      console.log('\n🆕 New plugins in feed:');
      newPlugins.forEach(plugin => {
        console.log(`   - ${plugin.name} by ${plugin.author}`);
      });
    } else {
      console.log('\nℹ️  No new plugins to add to RSS feed');
    }

    console.log('\n✅ RSS feed generation completed!');

  } catch (error) {
    console.error('\n❌ Error generating RSS feed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

