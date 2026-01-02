#!/usr/bin/env node

/**
 * SBOM + OSV analysis pipeline
 * Runs OSV analysis, summary aggregation, and top100 enrichment in sequence.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const SKIP_ANALYZE = args.includes('--skip-analyze');
const SKIP_SUMMARY = args.includes('--skip-summary');
const SKIP_ENRICH = args.includes('--skip-enrich');
const SKIP_MERGE = args.includes('--skip-merge');
const SHOW_HELP = args.includes('--help') || args.includes('-h');

const passthrough = args.filter((arg) => ![
  '--skip-analyze',
  '--skip-summary',
  '--skip-enrich',
  '--skip-merge',
  '--help',
  '-h',
].includes(arg));

if (SHOW_HELP) {
  console.log('Usage: node run-sbom-osv-analysis.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --skip-analyze   Skip OSV analysis (.analysis.json) generation');
  console.log('  --skip-summary   Skip vulnerability-summary.json aggregation');
  console.log('  --skip-enrich    Skip top100.json vulnerability enrichment');
  console.log('  --skip-merge     Skip merging top100.sbom_analysis.json into top100.json');
  console.log('');
  console.log('Other args are passed to analyze-osv-vulnerabilities.js (e.g., --force, --limit=50)');
  process.exit(0);
}

const internalDir = path.join(__dirname, 'internal');
const helperDir = fs.existsSync(path.join(internalDir, 'analyze-osv-vulnerabilities.js'))
  ? internalDir
  : __dirname;

function runStep(label, scriptName, stepArgs) {
  const scriptPath = path.join(helperDir, scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error(`Missing script: ${scriptPath}`);
    process.exit(1);
  }
  console.log(`\n== ${label} ==`);
  const result = spawnSync(process.execPath, [scriptPath, ...stepArgs], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Step failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('Starting SBOM + OSV analysis pipeline');

if (!SKIP_ANALYZE) {
  runStep('Analyze OSV scans', 'analyze-osv-vulnerabilities.js', passthrough);
}
if (!SKIP_SUMMARY) {
  runStep('Generate vulnerability summary', 'generate-vulnerability-summary.js', []);
}
if (!SKIP_ENRICH) {
  runStep('Enrich top100.json files', 'enrich-with-vulnerability-data.js', []);
}
if (!SKIP_MERGE) {
  runStep('Merge top100.sbom_analysis.json', 'merge-top100-sbom-analysis.js', []);
}

console.log('\nPipeline complete.');
