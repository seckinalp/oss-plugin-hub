import { BasePlugin } from '@/types/plugin';

/**
 * Export plugins as JSON file
 */
export function exportAsJSON(plugins: BasePlugin[], filename: string = 'plugins.json') {
  const jsonString = JSON.stringify(plugins, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadFile(blob, filename);
}

/**
 * Export plugins as SQL INSERT statements
 */
export function exportAsSQL(plugins: BasePlugin[], tableName: string = 'plugins') {
  let sql = `-- SQL Export of ${plugins.length} plugins\n`;
  sql += `-- Generated on ${new Date().toISOString()}\n\n`;
  
  // Create table statement
  sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
  sql += `  name VARCHAR(255) NOT NULL,\n`;
  sql += `  author VARCHAR(255) NOT NULL,\n`;
  sql += `  description TEXT,\n`;
  sql += `  repo VARCHAR(255),\n`;
  sql += `  platform VARCHAR(50) NOT NULL,\n`;
  sql += `  branch VARCHAR(100),\n`;
  sql += `  author_url VARCHAR(255),\n`;
  sql += `  funding_url VARCHAR(255)\n`;
  sql += `);\n\n`;
  
  // Insert statements
  if (plugins.length > 0) {
    sql += `INSERT INTO ${tableName} (id, name, author, description, repo, platform, branch, author_url, funding_url) VALUES\n`;
    
    const values = plugins.map((plugin, index) => {
      const id = escapeSQLString(plugin.id);
      const name = escapeSQLString(plugin.name);
      const author = escapeSQLString(plugin.author);
      const description = escapeSQLString(plugin.description);
      const repo = escapeSQLString(plugin.repo);
      const platform = escapeSQLString(plugin.platform);
      const branch = plugin.branch ? `'${escapeSQLString(plugin.branch)}'` : 'NULL';
      const authorUrl = plugin.authorUrl ? `'${escapeSQLString(plugin.authorUrl)}'` : 'NULL';
      const fundingUrl = plugin.fundingUrl ? `'${escapeSQLString(plugin.fundingUrl)}'` : 'NULL';
      
      const comma = index < plugins.length - 1 ? ',' : ';';
      return `  ('${id}', '${name}', '${author}', '${description}', '${repo}', '${platform}', ${branch}, ${authorUrl}, ${fundingUrl})${comma}`;
    });
    
    sql += values.join('\n');
  }
  
  const blob = new Blob([sql], { type: 'text/plain' });
  downloadFile(blob, `${tableName}.sql`);
}

/**
 * Export plugins as CSV file
 */
export function exportAsCSV(plugins: BasePlugin[], filename: string = 'plugins.csv') {
  const headers = ['id', 'name', 'author', 'description', 'repo', 'platform', 'branch', 'authorUrl', 'fundingUrl'];
  
  let csv = headers.join(',') + '\n';
  
  plugins.forEach(plugin => {
    const row = [
      escapeCSVField(plugin.id),
      escapeCSVField(plugin.name),
      escapeCSVField(plugin.author),
      escapeCSVField(plugin.description),
      escapeCSVField(plugin.repo),
      escapeCSVField(plugin.platform),
      escapeCSVField(plugin.branch || ''),
      escapeCSVField(plugin.authorUrl || ''),
      escapeCSVField(plugin.fundingUrl || ''),
    ];
    csv += row.join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, filename);
}

/**
 * Escape SQL strings
 */
function escapeSQLString(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

/**
 * Escape CSV fields
 */
function escapeCSVField(field: string): string {
  if (!field) return '""';
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return `"${field}"`;
}

/**
 * Download a file
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

