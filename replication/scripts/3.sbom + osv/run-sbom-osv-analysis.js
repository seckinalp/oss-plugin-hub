#!/usr/bin/env node

/**
 * SBOM + OSV analysis pipeline (single file).
 * Runs OSV analysis, summary aggregation, top100 enrichment, and merge.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const SHOW_HELP = args.includes('--help') || args.includes('-h');

const SKIP_ANALYZE = args.includes('--skip-analyze');
const SKIP_SUMMARY = args.includes('--skip-summary');
const SKIP_ENRICH = args.includes('--skip-enrich');
const SKIP_MERGE = args.includes('--skip-merge');

const FORCE = args.includes('--force');
const VERBOSE = args.includes('--verbose');

const LIMIT = parseNumberArg(args, '--limit');
const DATA_DIR_OVERRIDE = readArgValue(args, '--data-dir');

const PLATFORMS = [
  'chrome',
  'firefox',
  'homeassistant',
  'jetbrains',
  'minecraft',
  'obsidian',
  'sublime',
  'vscode',
  'wordpress',
];

if (SHOW_HELP) {
  printUsage();
  process.exit(0);
}

const DATA_DIR = resolveDataDir(DATA_DIR_OVERRIDE);
if (!DATA_DIR) {
  console.error('Error: data directory not found. Use --data-dir=PATH if needed.');
  process.exit(1);
}

const OSV_SCANS_DIR = path.join(DATA_DIR, 'osv-scans');
const SBOM_DIR = path.join(DATA_DIR, 'sbom');
const SUMMARY_FILE = path.join(DATA_DIR, 'vulnerability-summary.json');

console.log('Starting SBOM + OSV analysis pipeline');
console.log(`Data dir: ${DATA_DIR}`);
if (LIMIT !== null) console.log(`Analyze limit: ${LIMIT}`);
if (FORCE) console.log('Analyze force: enabled');
if (VERBOSE) console.log('Analyze verbose: enabled');
console.log('');

if (!SKIP_ANALYZE) {
  runAnalyze({
    scansDir: OSV_SCANS_DIR,
    force: FORCE,
    verbose: VERBOSE,
    limit: LIMIT,
  });
}

if (!SKIP_SUMMARY) {
  runSummary({
    scansDir: OSV_SCANS_DIR,
    outputFile: SUMMARY_FILE,
  });
}

if (!SKIP_ENRICH) {
  runEnrich({
    dataDir: DATA_DIR,
    scansDir: OSV_SCANS_DIR,
    sbomDir: SBOM_DIR,
    platforms: PLATFORMS,
  });
}

if (!SKIP_MERGE) {
  runMerge({
    dataDir: DATA_DIR,
    platforms: PLATFORMS,
  });
}

console.log('\nPipeline complete.');

function printUsage() {
  console.log('Usage: node run-sbom-osv-analysis.js [options]');
  console.log('');
  console.log('Pipeline options:');
  console.log('  --skip-analyze   Skip OSV analysis (.analysis.json) generation');
  console.log('  --skip-summary   Skip vulnerability-summary.json aggregation');
  console.log('  --skip-enrich    Skip top100.json vulnerability enrichment');
  console.log('  --skip-merge     Skip merging top100.sbom_analysis.json into top100.json');
  console.log('');
  console.log('Analyze options:');
  console.log('  --force          Overwrite existing .analysis.json files');
  console.log('  --verbose        Show per-file statistics');
  console.log('  --limit=NUM      Only analyze the first NUM OSV scan files');
  console.log('');
  console.log('General options:');
  console.log('  --data-dir=PATH  Override data directory');
}

function readArgValue(argv, name) {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 1);
  }
  const idx = argv.indexOf(name);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

function parseNumberArg(argv, name) {
  const value = readArgValue(argv, name);
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveDataDir(override) {
  if (override && fs.existsSync(override)) {
    return path.resolve(override);
  }
  const candidates = [
    path.resolve(__dirname, '..', 'data'),
    path.resolve(__dirname, '..', '..', 'data'),
    path.resolve(process.cwd(), 'data'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function runAnalyze({ scansDir, force, verbose, limit }) {
  console.log('== Analyze OSV scans ==');

  if (!fs.existsSync(scansDir)) {
    console.error(`Error: OSV scans directory not found: ${scansDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(scansDir)
    .filter((f) => f.endsWith('.osv.json') && !f.endsWith('.analysis.json'));
  const targetFiles = limit ? files.slice(0, limit) : files;

  console.log(`Processing ${targetFiles.length} OSV scan results...`);
  console.log(`Output directory: ${scansDir}`);
  if (force) console.log('Force mode: overwriting existing analyses');
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
    const inputPath = path.join(scansDir, file);
    const outputPath = inputPath.replace('.osv.json', '.analysis.json');

    if (!force && fs.existsSync(outputPath)) {
      skipped += 1;
      continue;
    }

    try {
      console.log(`Analyzing ${file}...`);

      const osvData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      const analysis = analyzeOSVScan(osvData);

      const result = {
        analyzedAt: new Date().toISOString(),
        source: file,
        ...analysis,
      };

      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

      allStats.totalScans += 1;
      allStats.totalVulnerabilities += analysis.summary.totalVulnerabilities;
      allStats.totalCritical += analysis.summary.severityBreakdown.CRITICAL;
      allStats.totalHigh += analysis.summary.severityBreakdown.HIGH;
      allStats.totalMedium += analysis.summary.severityBreakdown.MEDIUM;
      allStats.totalLow += analysis.summary.severityBreakdown.LOW;

      if (verbose) {
        console.log(`  Vulnerabilities: ${analysis.summary.totalVulnerabilities}`);
        console.log(
          `  Severity: CRIT=${analysis.summary.severityBreakdown.CRITICAL},` +
          ` HIGH=${analysis.summary.severityBreakdown.HIGH},` +
          ` MED=${analysis.summary.severityBreakdown.MEDIUM},` +
          ` LOW=${analysis.summary.severityBreakdown.LOW}`
        );
        console.log(`  Stale packages: ${analysis.summary.stalePackages}`);
        console.log('');
      }

      processed += 1;
    } catch (err) {
      console.error(`  Error processing ${file}: ${err.message}`);
      failed += 1;
    }
  }

  console.log('\nAnalysis complete.');
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log('');

  if (processed > 0) {
    console.log('Overall statistics:');
    console.log(`  Total scans: ${allStats.totalScans}`);
    console.log(`  Total vulnerabilities: ${allStats.totalVulnerabilities}`);
    console.log(`  CRITICAL: ${allStats.totalCritical}`);
    console.log(`  HIGH:     ${allStats.totalHigh}`);
    console.log(`  MEDIUM:   ${allStats.totalMedium}`);
    console.log(`  LOW:      ${allStats.totalLow}`);
  }

  console.log('');
}

function parseCVSSScore(cvssString) {
  if (!cvssString) return null;
  const match = cvssString.match(/CVSS:[\d.]+\/.*?(?:^|\/)([A-Z]+):([A-Z]+)/);
  if (!match) return null;
  const scoreMatch = cvssString.match(/(\d+\.\d+)/);
  return scoreMatch ? parseFloat(scoreMatch[1]) : null;
}

function getSeverityScore(vulnerability) {
  const maxSev = vulnerability.max_severity || vulnerability.groups?.[0]?.max_severity;
  if (maxSev) {
    const score = parseFloat(maxSev);
    if (!isNaN(score)) return score;
  }

  const severity = vulnerability.severity || vulnerability.vulnerabilities?.[0]?.severity;
  if (Array.isArray(severity)) {
    for (const s of severity) {
      if (s.type === 'CVSS_V3' || s.type === 'CVSS_V4') {
        const score = parseCVSSScore(s.score);
        if (score !== null) return score;
      }
    }
  }

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

function categorizeSeverity(score) {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

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
          const fixDate = modifiedDate || publishedDate || new Date();
          const now = new Date();
          const daysSinceFix = Math.floor((now - fixDate) / (1000 * 60 * 60 * 24));
          const monthsSinceFix = Math.floor(daysSinceFix / 30);

          const isOldFix = daysSinceFix > 180;

          return {
            isStale: true,
            currentVersion,
            fixedIn: event.fixed,
            recommendation: `Upgrade to ${event.fixed} or later`,
            fixAvailableSince: fixDate.toISOString(),
            daysSinceFix,
            monthsSinceFix,
            isOldFix,
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

  return cweIds.map((id) => ({
    id,
    name: cweNames[id] || 'Unknown CWE',
  }));
}

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
      stalePackagesOldFix: 0,
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

        if (!seenVulnIds.has(vulnId)) {
          seenVulnIds.add(vulnId);
          analysis.summary.uniqueVulnerabilities += 1;
        }

        analysis.summary.totalVulnerabilities += 1;

        const severityScore = getSeverityScore({ vulnerabilities: [vuln] });
        const severityCategory = categorizeSeverity(severityScore);
        analysis.summary.severityBreakdown[severityCategory] += 1;

        const ageInfo = getVulnerabilityAge({ vulnerabilities: [vuln] });
        if (ageInfo.isRecent) {
          analysis.summary.recentVulnerabilities += 1;
        }

        const staleInfo = isStale(pkg, { vulnerabilities: [vuln] });
        if (staleInfo.fixedIn) {
          analysis.summary.hasFixAvailable += 1;
        }

        const cwes = extractCWEs({ vulnerabilities: [vuln] });
        const aliases = vuln.aliases || [];

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

          if (staleInfo.isOldFix) {
            analysis.summary.stalePackagesOldFix += 1;
          }
        }
      }
    }
  }

  analysis.summary.affectedPackages = packageMap.size;
  analysis.summary.stalePackages = analysis.staleDependencies.length;

  if (analysis.summary.severityBreakdown.CRITICAL > 0) {
    analysis.recommendations.push({
      priority: 'URGENT',
      message: `${analysis.summary.severityBreakdown.CRITICAL} CRITICAL vulnerabilities found. Immediate action required.`,
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
      message: `${analysis.summary.stalePackagesOldFix} packages have fixes available for more than 6 months. Update urgently.`,
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

  analysis.vulnerabilities.sort((a, b) => b.severityScore - a.severityScore);

  const staleDepsMap = new Map();
  for (const dep of analysis.staleDependencies) {
    const key = `${dep.package}@${dep.currentVersion}`;
    if (!staleDepsMap.has(key)) {
      staleDepsMap.set(key, dep);
    } else {
      staleDepsMap.get(key).vulnerabilities.push(...dep.vulnerabilities);
    }
  }
  analysis.staleDependencies = Array.from(staleDepsMap.values());

  return analysis;
}

function runSummary({ scansDir, outputFile }) {
  console.log('== Generate vulnerability summary ==');

  if (!fs.existsSync(scansDir)) {
    console.error(`Error: OSV scans directory not found: ${scansDir}`);
    process.exit(1);
  }

  const analysisFiles = fs.readdirSync(scansDir)
    .filter((f) => f.endsWith('.analysis.json'));

  console.log(`Processing ${analysisFiles.length} analysis files...`);

  const summary = {
    generatedAt: new Date().toISOString(),
    totalPluginsAnalyzed: analysisFiles.length,
    overall: {
      totalVulnerabilities: 0,
      uniqueVulnerabilities: new Set(),
      affectedPlugins: 0,
      cleanPlugins: 0,
      severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      stalePackages: 0,
      oldFixesAvailable: 0,
      recentVulnerabilities: 0,
    },
    highRiskPlugins: [],
    mostVulnerable: [],
    stalestDependencies: [],
    byPlatform: {},
    bySeverity: {
      critical: [],
      high: [],
      medium: [],
      low: [],
    },
  };

  const allStale = [];

  for (const file of analysisFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(scansDir, file), 'utf8'));
    const s = data.summary;
    const pluginName = file.replace('.analysis.json', '').replace(/__/g, '/');

    const platform = detectPlatform(pluginName, data);

    if (!summary.byPlatform[platform]) {
      summary.byPlatform[platform] = {
        total: 0,
        vulnerabilities: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        stale: 0,
        oldFixes: 0,
      };
    }

    summary.byPlatform[platform].total += 1;
    summary.byPlatform[platform].vulnerabilities += s.totalVulnerabilities;
    summary.byPlatform[platform].critical += s.severityBreakdown.CRITICAL;
    summary.byPlatform[platform].high += s.severityBreakdown.HIGH;
    summary.byPlatform[platform].medium += s.severityBreakdown.MEDIUM;
    summary.byPlatform[platform].low += s.severityBreakdown.LOW;
    summary.byPlatform[platform].stale += s.stalePackages;
    summary.byPlatform[platform].oldFixes += s.stalePackagesOldFix || 0;

    summary.overall.totalVulnerabilities += s.totalVulnerabilities;
    summary.overall.severityBreakdown.CRITICAL += s.severityBreakdown.CRITICAL;
    summary.overall.severityBreakdown.HIGH += s.severityBreakdown.HIGH;
    summary.overall.severityBreakdown.MEDIUM += s.severityBreakdown.MEDIUM;
    summary.overall.severityBreakdown.LOW += s.severityBreakdown.LOW;
    summary.overall.stalePackages += s.stalePackages;
    summary.overall.oldFixesAvailable += s.stalePackagesOldFix || 0;
    summary.overall.recentVulnerabilities += s.recentVulnerabilities;

    data.vulnerabilities.forEach((v) => {
      summary.overall.uniqueVulnerabilities.add(v.id);
    });

    if (s.totalVulnerabilities === 0) {
      summary.overall.cleanPlugins += 1;
    } else {
      summary.overall.affectedPlugins += 1;
    }

    if (s.severityBreakdown.CRITICAL > 0 || s.severityBreakdown.HIGH > 0) {
      summary.highRiskPlugins.push({
        plugin: pluginName,
        platform,
        critical: s.severityBreakdown.CRITICAL,
        high: s.severityBreakdown.HIGH,
        medium: s.severityBreakdown.MEDIUM,
        total: s.totalVulnerabilities,
        oldFixes: s.stalePackagesOldFix || 0,
      });
    }

    if (data.staleDependencies) {
      data.staleDependencies.forEach((dep) => {
        allStale.push({
          ...dep,
          plugin: pluginName,
          platform,
        });
      });
    }

    if (s.totalVulnerabilities > 0) {
      summary.mostVulnerable.push({
        plugin: pluginName,
        platform,
        vulnerabilities: s.totalVulnerabilities,
        critical: s.severityBreakdown.CRITICAL,
        high: s.severityBreakdown.HIGH,
        medium: s.severityBreakdown.MEDIUM,
        low: s.severityBreakdown.LOW,
        stale: s.stalePackages,
        oldFixes: s.stalePackagesOldFix || 0,
      });
    }

    if (s.severityBreakdown.CRITICAL > 0) {
      summary.bySeverity.critical.push({ plugin: pluginName, platform, count: s.severityBreakdown.CRITICAL });
    } else if (s.severityBreakdown.HIGH > 0) {
      summary.bySeverity.high.push({ plugin: pluginName, platform, count: s.severityBreakdown.HIGH });
    } else if (s.severityBreakdown.MEDIUM > 0) {
      summary.bySeverity.medium.push({ plugin: pluginName, platform, count: s.severityBreakdown.MEDIUM });
    } else if (s.severityBreakdown.LOW > 0) {
      summary.bySeverity.low.push({ plugin: pluginName, platform, count: s.severityBreakdown.LOW });
    }
  }

  summary.overall.uniqueVulnerabilities = summary.overall.uniqueVulnerabilities.size;

  summary.highRiskPlugins.sort((a, b) =>
    (b.critical * 1000 + b.high * 100 + b.medium) -
    (a.critical * 1000 + a.high * 100 + a.medium)
  );

  summary.mostVulnerable.sort((a, b) => b.vulnerabilities - a.vulnerabilities);
  summary.mostVulnerable = summary.mostVulnerable.slice(0, 50);

  summary.stalestDependencies = allStale
    .sort((a, b) => b.daysSinceFix - a.daysSinceFix)
    .slice(0, 50);

  summary.bySeverity.critical.sort((a, b) => b.count - a.count);
  summary.bySeverity.high.sort((a, b) => b.count - a.count);
  summary.bySeverity.medium.sort((a, b) => b.count - a.count);

  fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

  console.log('Summary complete.');
  console.log(`  Plugins analyzed: ${summary.totalPluginsAnalyzed}`);
  console.log(`  Total vulnerabilities: ${summary.overall.totalVulnerabilities}`);
  console.log(`  Unique CVEs/GHSAs: ${summary.overall.uniqueVulnerabilities}`);
  console.log(`  Affected plugins: ${summary.overall.affectedPlugins}`);
  console.log(`  Clean plugins: ${summary.overall.cleanPlugins}`);
  console.log('');
  console.log('Severity breakdown:');
  console.log(`  CRITICAL: ${summary.overall.severityBreakdown.CRITICAL}`);
  console.log(`  HIGH:     ${summary.overall.severityBreakdown.HIGH}`);
  console.log(`  MEDIUM:   ${summary.overall.severityBreakdown.MEDIUM}`);
  console.log(`  LOW:      ${summary.overall.severityBreakdown.LOW}`);
  console.log('');
  console.log('Dependency health:');
  console.log(`  Stale packages: ${summary.overall.stalePackages}`);
  console.log(`  Old fixes (>6mo): ${summary.overall.oldFixesAvailable}`);
  console.log(`  Recent vulnerabilities: ${summary.overall.recentVulnerabilities}`);
  console.log('');

  console.log(`Output saved to: ${outputFile}\n`);
}

function detectPlatform(pluginName, data) {
  const lower = pluginName.toLowerCase();

  if (data.vulnerabilities && data.vulnerabilities[0]?.affected?.ecosystem) {
    const ecosystem = data.vulnerabilities[0].affected.ecosystem;
    if (ecosystem === 'npm') {
      if (lower.includes('vscode') || lower.includes('microsoft')) return 'vscode';
      if (lower.includes('obsidian')) return 'obsidian';
      return 'chrome';
    }
  }

  if (lower.includes('vscode') || lower.includes('microsoft')) return 'vscode';
  if (lower.includes('obsidian')) return 'obsidian';
  if (lower.includes('jetbrains')) return 'jetbrains';
  if (lower.includes('wordpress')) return 'wordpress';
  if (lower.includes('home-assistant') || lower.includes('homeassistant')) return 'homeassistant';
  if (lower.includes('minecraft')) return 'minecraft';
  if (lower.includes('sublime')) return 'sublime';
  if (lower.includes('firefox') || lower.includes('mozilla')) return 'firefox';

  return 'unknown';
}

function runEnrich({ dataDir, scansDir, sbomDir, platforms }) {
  console.log('== Enrich top100 with vulnerability data ==');

  const analysisMap = new Map();
  const osvScanMap = new Map();
  const sbomMap = new Set();

  const analysisFiles = fs.existsSync(scansDir)
    ? fs.readdirSync(scansDir).filter((f) => f.endsWith('.analysis.json'))
    : [];

  analysisFiles.forEach((file) => {
    const repo = file.replace('.analysis.json', '').replace(/__/g, '/');
    const data = JSON.parse(fs.readFileSync(path.join(scansDir, file), 'utf8'));
    analysisMap.set(repo, data);
  });

  const osvFiles = fs.existsSync(scansDir)
    ? fs.readdirSync(scansDir).filter((f) => f.endsWith('.osv.json'))
    : [];

  osvFiles.forEach((file) => {
    const repo = file.replace('.osv.json', '').replace(/__/g, '/');
    osvScanMap.set(repo, true);
  });

  const sbomFiles = fs.existsSync(sbomDir)
    ? fs.readdirSync(sbomDir).filter((f) => f.endsWith('.sbom.json'))
    : [];

  sbomFiles.forEach((file) => {
    const repo = file.replace('.sbom.json', '').replace(/__/g, '/');
    sbomMap.add(repo);
  });

  console.log(`Loaded ${analysisMap.size} analysis files`);
  console.log(`Loaded ${osvScanMap.size} OSV scan files`);
  console.log(`Loaded ${sbomMap.size} SBOM files`);
  console.log('');

  let totalPlugins = 0;
  let pluginsWithAnalysis = 0;
  let pluginsWithSbomNoScan = 0;
  let pluginsNoSbom = 0;
  let pluginsNoRepo = 0;

  for (const platform of platforms) {
    const filePath = path.join(dataDir, platform, 'top100.json');

    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${platform}: top100.json not found`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let platformAnalyzed = 0;
    let platformNoSbom = 0;
    let platformNoScan = 0;
    let platformNoRepo = 0;

    data.top100.forEach((plugin) => {
      totalPlugins += 1;

      if (!plugin.repo) {
        plugin.vulnerabilityAnalysis = {
          status: 'no_repo',
          message: 'No GitHub repository available',
          analyzed: false,
        };
        pluginsNoRepo += 1;
        platformNoRepo += 1;
        return;
      }

      const repo = plugin.repo;

      if (analysisMap.has(repo)) {
        const analysis = analysisMap.get(repo);
        const riskLevel = determineRiskLevel(analysis.summary);
        const staleByTime = categorizeStalePackages(analysis.staleDependencies || []);

        plugin.vulnerabilityAnalysis = {
          status: 'analyzed',
          analyzed: true,
          analyzedAt: analysis.analyzedAt || new Date().toISOString(),
          summary: {
            totalVulnerabilities: analysis.summary.totalVulnerabilities,
            criticalVulnerabilities: analysis.summary.severityBreakdown.CRITICAL,
            highVulnerabilities: analysis.summary.severityBreakdown.HIGH,
            mediumVulnerabilities: analysis.summary.severityBreakdown.MEDIUM,
            lowVulnerabilities: analysis.summary.severityBreakdown.LOW,
            stalePackages: analysis.summary.stalePackages,
            stalePackages6Months: staleByTime.sixMonths,
            stalePackages1Year: staleByTime.oneYear,
            stalePackages2Years: staleByTime.twoYears,
            stalePackages3YearsPlus: staleByTime.threePlus,
            recentVulnerabilities: analysis.summary.recentVulnerabilities || 0,
          },
          riskLevel,
          riskDescription: getRiskDescription(riskLevel, analysis.summary),
        };
        pluginsWithAnalysis += 1;
        platformAnalyzed += 1;
      } else if (sbomMap.has(repo)) {
        if (osvScanMap.has(repo)) {
          plugin.vulnerabilityAnalysis = {
            status: 'scan_failed',
            message: 'OSV scan completed but analysis failed',
            analyzed: false,
          };
        } else {
          plugin.vulnerabilityAnalysis = {
            status: 'not_scanned',
            message: 'SBOM available but not yet scanned with OSV',
            analyzed: false,
          };
        }
        pluginsWithSbomNoScan += 1;
        platformNoScan += 1;
      } else {
        plugin.vulnerabilityAnalysis = {
          status: 'no_sbom',
          message: 'SBOM not available from GitHub (repository has no analyzable dependencies or uses unsupported package manager)',
          analyzed: false,
        };
        pluginsNoSbom += 1;
        platformNoSbom += 1;
      }
    });

    data.metadata = data.metadata || {};
    data.metadata.lastVulnerabilityUpdate = new Date().toISOString();
    data.metadata.vulnerabilityAnalysis = {
      total: data.top100.length,
      analyzed: platformAnalyzed,
      noSbom: platformNoSbom,
      notScanned: platformNoScan,
      noRepo: platformNoRepo,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`${platform}:`);
    console.log(`  Total: ${data.top100.length}`);
    console.log(`  Analyzed: ${platformAnalyzed}`);
    console.log(`  No SBOM: ${platformNoSbom}`);
    console.log(`  Not scanned: ${platformNoScan}`);
    console.log(`  No repo: ${platformNoRepo}`);
  }

  console.log('\nEnrichment complete.');
  console.log(`  Total plugins: ${totalPlugins}`);
  console.log(`  With analysis: ${pluginsWithAnalysis} (${percent(pluginsWithAnalysis, totalPlugins)}%)`);
  console.log(`  SBOM but no scan: ${pluginsWithSbomNoScan} (${percent(pluginsWithSbomNoScan, totalPlugins)}%)`);
  console.log(`  No SBOM: ${pluginsNoSbom} (${percent(pluginsNoSbom, totalPlugins)}%)`);
  console.log(`  No repo: ${pluginsNoRepo} (${percent(pluginsNoRepo, totalPlugins)}%)`);
  console.log('');
}

function percent(part, total) {
  if (!total) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

function determineRiskLevel(summary) {
  if (summary.severityBreakdown.CRITICAL > 0) {
    return 'critical';
  }
  if (summary.severityBreakdown.HIGH > 0) {
    return 'high';
  }
  if (summary.severityBreakdown.MEDIUM > 0) {
    return 'medium';
  }
  if (summary.severityBreakdown.LOW > 0) {
    return 'low';
  }
  return 'clean';
}

function getRiskDescription(riskLevel, summary) {
  const descriptions = {
    critical: `Contains ${summary.severityBreakdown.CRITICAL} CRITICAL severity vulnerabilities that pose immediate security risks and should be addressed urgently.`,
    high: `Contains ${summary.severityBreakdown.HIGH} HIGH severity vulnerabilities that pose significant security risks and should be prioritized.`,
    medium: `Contains ${summary.severityBreakdown.MEDIUM} MEDIUM severity vulnerabilities that present moderate security concerns.`,
    low: `Contains ${summary.severityBreakdown.LOW} LOW severity vulnerabilities with minimal security impact.`,
    clean: 'No known vulnerabilities detected in dependencies. Regular monitoring is still recommended.',
  };

  return descriptions[riskLevel] || 'Risk level assessment unavailable.';
}

function categorizeStalePackages(staleDependencies) {
  const categories = {
    sixMonths: 0,
    oneYear: 0,
    twoYears: 0,
    threePlus: 0,
  };

  staleDependencies.forEach((dep) => {
    if (!dep.monthsSinceFix) return;

    const months = dep.monthsSinceFix;

    if (months >= 6 && months < 12) {
      categories.sixMonths += 1;
    } else if (months >= 12 && months < 24) {
      categories.oneYear += 1;
    } else if (months >= 24 && months < 36) {
      categories.twoYears += 1;
    } else if (months >= 36) {
      categories.threePlus += 1;
    }
  });

  return categories;
}

function runMerge({ dataDir, platforms }) {
  console.log('== Merge top100.sbom_analysis.json ==');

  for (const platform of platforms) {
    const top100Path = path.join(dataDir, platform, 'top100.json');
    const sbomPath = path.join(dataDir, platform, 'top100.sbom_analysis.json');

    const top100 = readJson(top100Path);
    const sbom = readJson(sbomPath);

    if (!top100 || !Array.isArray(top100.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }
    if (!sbom || !Array.isArray(sbom.top100)) {
      console.warn(`Skipping ${platform}: missing top100.sbom_analysis.json`);
      continue;
    }

    const sourceMap = buildSourceMap(sbom.top100);
    const stats = { added: 0, missing: 0, matched: 0 };

    for (const entry of top100.top100) {
      const byId = entry.id ? sourceMap.byId.get(String(entry.id)) : null;
      const repo = normalizeRepo(entry.repo);
      const byRepo = repo ? sourceMap.byRepo.get(repo.toLowerCase()) : null;
      const source = byId || byRepo;
      if (!source) {
        stats.missing += 1;
        continue;
      }
      stats.matched += 1;
      mergeMissing(entry, source, stats);
    }

    writeJson(top100Path, top100);
    console.log(`${platform}: matched ${stats.matched}, missing ${stats.missing}, added fields ${stats.added}`);
  }
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeRepo(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let repo = raw.trim();
  const lower = repo.toLowerCase();
  if ((lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('git@')) &&
    !lower.includes('github.com')) {
    return null;
  }
  repo = repo.replace(/^https?:\/\/github\.com\//i, '');
  repo = repo.replace(/^git@github\.com:/i, '');
  repo = repo.replace(/^github\.com\//i, '');
  repo = repo.replace(/\.git$/i, '');
  repo = repo.split('#')[0].split('?')[0];
  repo = repo.replace(/\/+$/, '');
  const parts = repo.split('/');
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

function mergeMissing(target, source, stats) {
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (current === undefined || current === null) {
      target[key] = value;
      stats.added += 1;
      continue;
    }

    if (Array.isArray(current) && Array.isArray(value)) {
      if (current.length === 0 && value.length > 0) {
        target[key] = value;
        stats.added += 1;
      }
      continue;
    }

    if (typeof current === 'object' && typeof value === 'object' &&
      !Array.isArray(current) && !Array.isArray(value)) {
      mergeMissing(current, value, stats);
    }
  }
  return target;
}

function buildSourceMap(entries) {
  const byId = new Map();
  const byRepo = new Map();

  for (const entry of entries) {
    if (entry.id) {
      byId.set(String(entry.id), entry);
    }
    const repo = normalizeRepo(entry.repo);
    if (repo) {
      byRepo.set(repo.toLowerCase(), entry);
    }
  }

  return { byId, byRepo };
}
