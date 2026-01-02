#!/usr/bin/env node

/**
 * OSV Vulnerability Analysis
 * Analyzes OSV scan results and generates human-readable security reports
 * Output: data/osv-scans/*.analysis.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OSV_SCANS_DIR = path.join(__dirname, '../data/osv-scans');
const FORCE = process.argv.includes('--force');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

console.log('=== OSV Vulnerability Analysis ===\n');

/**
 * Parse CVSS score to get numeric value
 */
function parseCVSSScore(cvssString) {
  if (!cvssString) return null;
  
  // Extract base score from CVSS string (e.g., "CVSS:3.1/AV:N/AC:L/...")
  const match = cvssString.match(/CVSS:[\d.]+\/.*?(?:^|\/)([A-Z]+):([A-Z]+)/);
  if (!match) return null;
  
  // Try to extract numeric score if available
  const scoreMatch = cvssString.match(/(\d+\.\d+)/);
  return scoreMatch ? parseFloat(scoreMatch[1]) : null;
}

/**
 * Get numeric severity score from CVSS or database severity
 */
function getSeverityScore(vulnerability) {
  // Try max_severity from groups first
  const maxSev = vulnerability.max_severity || vulnerability.groups?.[0]?.max_severity;
  if (maxSev) {
    const score = parseFloat(maxSev);
    if (!isNaN(score)) return score;
  }
  
  // Try CVSS scores
  const severity = vulnerability.severity || vulnerability.vulnerabilities?.[0]?.severity;
  if (Array.isArray(severity)) {
    for (const s of severity) {
      if (s.type === 'CVSS_V3' || s.type === 'CVSS_V4') {
        const score = parseCVSSScore(s.score);
        if (score !== null) return score;
      }
    }
  }
  
  // Try database_specific severity
  const dbSeverity = vulnerability.database_specific?.severity ||
                      vulnerability.vulnerabilities?.[0]?.database_specific?.severity;
  
  const severityMap = {
    CRITICAL: 9.5,
    HIGH: 7.5,
    MODERATE: 5.0,
    MEDIUM: 5.0,
    LOW: 2.5,
  };
  
  return severityMap[dbSeverity] || 0;
}

/**
 * Categorize severity based on score
 */
function categorizeSeverity(score) {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Check if dependency is outdated based on vulnerability data
 */
function isStale(packageData, vulnerability) {
  const currentVersion = packageData.version;
  const affected = vulnerability.affected || vulnerability.vulnerabilities?.[0]?.affected || [];
  const vuln = vulnerability.vulnerabilities?.[0] || vulnerability;
  const publishedDate = vuln.published ? new Date(vuln.published) : null;
  const modifiedDate = vuln.modified ? new Date(vuln.modified) : null;
  
  for (const aff of affected) {
    const ranges = aff.ranges || [];
    for (const range of ranges) {
      const events = range.events || [];
      for (const event of events) {
        if (event.fixed) {
          // Calculate how long the fix has been available
          const fixDate = modifiedDate || publishedDate || new Date();
          const now = new Date();
          const daysSinceFix = Math.floor((now - fixDate) / (1000 * 60 * 60 * 24));
          const monthsSinceFix = Math.floor(daysSinceFix / 30);
          
          const isOldFix = daysSinceFix > 180; // > 6 months
          
          // If there's a fix available, the current version is stale
          return {
            isStale: true,
            currentVersion,
            fixedIn: event.fixed,
            recommendation: `Upgrade to ${event.fixed} or later`,
            fixAvailableSince: fixDate.toISOString(),
            daysSinceFix,
            monthsSinceFix,
            isOldFix, // Fix has been available for > 6 months
          };
        }
      }
    }
  }
  
  return {
    isStale: false,
    currentVersion,
    fixedIn: null,
    recommendation: 'No fix available yet - monitor for updates',
    fixAvailableSince: null,
    daysSinceFix: 0,
    monthsSinceFix: 0,
    isOldFix: false,
  };
}

/**
 * Determine if vulnerability is recent or old
 */
function getVulnerabilityAge(vulnerability) {
  const vuln = vulnerability.vulnerabilities?.[0] || vulnerability;
  const published = vuln.published;
  const modified = vuln.modified;
  
  if (!published) return { age: 'unknown', isRecent: false };
  
  const publishedDate = new Date(published);
  const now = new Date();
  const ageInDays = Math.floor((now - publishedDate) / (1000 * 60 * 60 * 24));
  
  let ageCategory;
  let isRecent = false;
  
  if (ageInDays <= 30) {
    ageCategory = 'Very Recent (< 1 month)';
    isRecent = true;
  } else if (ageInDays <= 180) {
    ageCategory = 'Recent (< 6 months)';
    isRecent = true;
  } else if (ageInDays <= 365) {
    ageCategory = 'Last Year';
    isRecent = false;
  } else {
    ageCategory = `${Math.floor(ageInDays / 365)} year(s) old`;
    isRecent = false;
  }
  
  return {
    age: ageCategory,
    isRecent,
    publishedDate: published,
    modifiedDate: modified,
    daysSincePublished: ageInDays,
  };
}

/**
 * Extract CWE information
 */
function extractCWEs(vulnerability) {
  const vuln = vulnerability.vulnerabilities?.[0] || vulnerability;
  const cweIds = vuln.database_specific?.cwe_ids || [];
  
  const cweNames = {
    'CWE-79': 'Cross-Site Scripting (XSS)',
    'CWE-89': 'SQL Injection',
    'CWE-78': 'OS Command Injection',
    'CWE-400': 'Uncontrolled Resource Consumption (DoS)',
    'CWE-502': 'Deserialization of Untrusted Data',
    'CWE-798': 'Use of Hard-coded Credentials',
    'CWE-918': 'Server-Side Request Forgery (SSRF)',
    'CWE-1333': 'Inefficient Regular Expression Complexity (ReDoS)',
    'CWE-1321': 'Improperly Controlled Modification of Object Prototype Attributes (Prototype Pollution)',
    'CWE-792': 'Incomplete Filtering of Special Elements',
  };
  
  return cweIds.map(id => ({
    id,
    name: cweNames[id] || 'Unknown CWE',
  }));
}

/**
 * Analyze a single OSV scan result
 */
function analyzeOSVScan(osvData) {
  const results = osvData.results || [];
  
  if (results.length === 0) {
    return {
      summary: {
        totalVulnerabilities: 0,
        uniqueVulnerabilities: 0,
        affectedPackages: 0,
        stalePackages: 0,
        severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        recentVulnerabilities: 0,
        hasFixAvailable: 0,
      },
      vulnerabilities: [],
      staleDependencies: [],
      recommendations: [],
    };
  }
  
  const analysis = {
    summary: {
      totalVulnerabilities: 0,
      uniqueVulnerabilities: 0,
      affectedPackages: 0,
      stalePackages: 0,
      stalePackagesOldFix: 0, // Fix available for > 6 months
      severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      recentVulnerabilities: 0,
      hasFixAvailable: 0,
    },
    vulnerabilities: [],
    staleDependencies: [],
    recommendations: [],
  };
  
  const seenVulnIds = new Set();
  const packageMap = new Map();
  
  // Process each result
  for (const result of results) {
    const packages = result.packages || [];
    
    for (const pkgData of packages) {
      const pkg = pkgData.package;
      const packageName = `${pkg.name}@${pkg.version}`;
      
      if (!packageMap.has(packageName)) {
        packageMap.set(packageName, {
          name: pkg.name,
          version: pkg.version,
          ecosystem: pkg.ecosystem,
          vulnerabilities: [],
        });
      }
      
      const packageInfo = packageMap.get(packageName);
      const vulnerabilities = pkgData.vulnerabilities || [];
      
      for (const vuln of vulnerabilities) {
        const vulnId = vuln.id;
        
        // Track unique vulnerabilities
        if (!seenVulnIds.has(vulnId)) {
          seenVulnIds.add(vulnId);
          analysis.summary.uniqueVulnerabilities++;
        }
        
        analysis.summary.totalVulnerabilities++;
        
        // Get severity
        const severityScore = getSeverityScore({ vulnerabilities: [vuln] });
        const severityCategory = categorizeSeverity(severityScore);
        analysis.summary.severityBreakdown[severityCategory]++;
        
        // Get age
        const ageInfo = getVulnerabilityAge({ vulnerabilities: [vuln] });
        if (ageInfo.isRecent) {
          analysis.summary.recentVulnerabilities++;
        }
        
        // Check for fix
        const staleInfo = isStale(pkg, { vulnerabilities: [vuln] });
        if (staleInfo.fixedIn) {
          analysis.summary.hasFixAvailable++;
        }
        
        // Extract CWEs
        const cwes = extractCWEs({ vulnerabilities: [vuln] });
        
        // Get CVE/aliases
        const aliases = vuln.aliases || [];
        
        // Build vulnerability details
        const vulnDetails = {
          id: vulnId,
          severity: severityCategory,
          severityScore,
          cvssScores: vuln.severity || [],
          aliases,
          summary: vuln.summary || 'No summary available',
          details: vuln.details || '',
          cwes,
          age: ageInfo,
          affected: {
            package: pkg.name,
            version: pkg.version,
            ecosystem: pkg.ecosystem,
          },
          fix: staleInfo,
          references: vuln.references || [],
        };
        
        analysis.vulnerabilities.push(vulnDetails);
        packageInfo.vulnerabilities.push(vulnDetails);
        
        // Track stale dependencies
        if (staleInfo.isStale) {
          analysis.staleDependencies.push({
            package: pkg.name,
            currentVersion: pkg.version,
            fixedIn: staleInfo.fixedIn,
            vulnerabilities: [vulnId],
            severity: severityCategory,
            recommendation: staleInfo.recommendation,
            fixAvailableSince: staleInfo.fixAvailableSince,
            daysSinceFix: staleInfo.daysSinceFix,
            monthsSinceFix: staleInfo.monthsSinceFix,
            isOldFix: staleInfo.isOldFix,
          });
          
          // Track packages with old fixes (> 6 months)
          if (staleInfo.isOldFix) {
            analysis.summary.stalePackagesOldFix++;
          }
        }
      }
    }
  }
  
  // Count affected packages
  analysis.summary.affectedPackages = packageMap.size;
  analysis.summary.stalePackages = analysis.staleDependencies.length;
  
  // Generate recommendations
  if (analysis.summary.severityBreakdown.CRITICAL > 0) {
    analysis.recommendations.push({
      priority: 'URGENT',
      message: `${analysis.summary.severityBreakdown.CRITICAL} CRITICAL vulnerabilities found! Immediate action required.`,
    });
  }
  
  if (analysis.summary.severityBreakdown.HIGH > 0) {
    analysis.recommendations.push({
      priority: 'HIGH',
      message: `${analysis.summary.severityBreakdown.HIGH} HIGH severity vulnerabilities detected. Update as soon as possible.`,
    });
  }
  
  if (analysis.summary.recentVulnerabilities > 0) {
    analysis.recommendations.push({
      priority: 'MEDIUM',
      message: `${analysis.summary.recentVulnerabilities} vulnerabilities were recently discovered (< 6 months old).`,
    });
  }
  
  if (analysis.summary.stalePackagesOldFix > 0) {
    analysis.recommendations.push({
      priority: 'HIGH',
      message: `${analysis.summary.stalePackagesOldFix} packages have fixes available for >6 months. Update urgently!`,
    });
  }
  
  if (analysis.summary.stalePackages > 0) {
    analysis.recommendations.push({
      priority: 'MEDIUM',
      message: `${analysis.summary.stalePackages} packages have known vulnerabilities with available fixes. Update recommended.`,
    });
  }
  
  if (analysis.summary.totalVulnerabilities === 0) {
    analysis.recommendations.push({
      priority: 'INFO',
      message: 'No vulnerabilities detected. Dependencies appear to be secure.',
    });
  }
  
  // Sort vulnerabilities by severity
  analysis.vulnerabilities.sort((a, b) => b.severityScore - a.severityScore);
  
  // Deduplicate stale dependencies
  const staleDepsMap = new Map();
  for (const dep of analysis.staleDependencies) {
    const key = `${dep.package}@${dep.currentVersion}`;
    if (!staleDepsMap.has(key)) {
      staleDepsMap.set(key, dep);
    } else {
      // Merge vulnerabilities
      staleDepsMap.get(key).vulnerabilities.push(...dep.vulnerabilities);
    }
  }
  analysis.staleDependencies = Array.from(staleDepsMap.values());
  
  return analysis;
}

/**
 * Main execution
 */
function main() {
  if (!fs.existsSync(OSV_SCANS_DIR)) {
    console.error(`Error: OSV scans directory not found: ${OSV_SCANS_DIR}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(OSV_SCANS_DIR)
    .filter(f => f.endsWith('.osv.json') && !f.endsWith('.analysis.json'));
  
  const targetFiles = LIMIT ? files.slice(0, LIMIT) : files;
  
  console.log(`Processing ${targetFiles.length} OSV scan results...`);
  console.log(`Output directory: ${OSV_SCANS_DIR}`);
  if (FORCE) console.log('Force mode: overwriting existing analyses');
  console.log('');
  
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  
  const allStats = {
    totalScans: 0,
    totalVulnerabilities: 0,
    totalCritical: 0,
    totalHigh: 0,
    totalMedium: 0,
    totalLow: 0,
  };
  
  for (const file of targetFiles) {
    const inputPath = path.join(OSV_SCANS_DIR, file);
    const outputPath = inputPath.replace('.osv.json', '.analysis.json');
    
    if (!FORCE && fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }
    
    try {
      console.log(`Analyzing ${file}...`);
      
      const osvData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      const analysis = analyzeOSVScan(osvData);
      
      // Add metadata
      const result = {
        analyzedAt: new Date().toISOString(),
        source: file,
        ...analysis,
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      
      allStats.totalScans++;
      allStats.totalVulnerabilities += analysis.summary.totalVulnerabilities;
      allStats.totalCritical += analysis.summary.severityBreakdown.CRITICAL;
      allStats.totalHigh += analysis.summary.severityBreakdown.HIGH;
      allStats.totalMedium += analysis.summary.severityBreakdown.MEDIUM;
      allStats.totalLow += analysis.summary.severityBreakdown.LOW;
      
      if (VERBOSE) {
        console.log(`  Vulnerabilities: ${analysis.summary.totalVulnerabilities}`);
        console.log(`  Severity: CRIT=${analysis.summary.severityBreakdown.CRITICAL}, HIGH=${analysis.summary.severityBreakdown.HIGH}, MED=${analysis.summary.severityBreakdown.MEDIUM}, LOW=${analysis.summary.severityBreakdown.LOW}`);
        console.log(`  Stale packages: ${analysis.summary.stalePackages}`);
        console.log('');
      }
      
      processed++;
    } catch (err) {
      console.error(`  ✖ Error processing ${file}: ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n======================================');
  console.log('Analysis Complete!');
  console.log('======================================\n');
  
  console.log('Summary:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log('');
  
  if (processed > 0) {
    console.log('Overall Statistics:');
    console.log(`  Total scans: ${allStats.totalScans}`);
    console.log(`  Total vulnerabilities: ${allStats.totalVulnerabilities}`);
    console.log(`  CRITICAL: ${allStats.totalCritical}`);
    console.log(`  HIGH: ${allStats.totalHigh}`);
    console.log(`  MEDIUM: ${allStats.totalMedium}`);
    console.log(`  LOW: ${allStats.totalLow}`);
  }
  
  console.log(`\nAnalysis files saved to: ${OSV_SCANS_DIR}\n`);
}

main();














