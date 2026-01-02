import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'paper', 'plugins_master_table.csv');

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

const COLUMNS = [
  'top100_id',
  'plugin_name',
  'platform',
  'author',
  'repo',
  'repository',
  'vendor_url',
  'download_url',
  'download_stats_updated',
  'extension_id',
  'xml_id',
  'version',
  'published_date',
  'release_date',
  'last_updated',
  'users',
  'downloads',
  'rating',
  'rating_count',
  'stars',
  'tags',
  'categories',
  'category',
  'source',
  'source_id',
  'sources_json',
  'pr_friction_median_days',
  'pr_friction_samples',
  'github_stars',
  'github_forks',
  'github_open_issues',
  'github_watchers',
  'github_created_at',
  'github_last_updated',
  'github_license',
  'github_language',
  'github_topics',
  'github_size',
  'github_default_branch',
  'github_archived',
  'github_disabled',
  'github_data_fetched_at',
  'scorecard_score',
  'scorecard_version',
  'scorecard_date',
  'scorecard_check_scores_json',
  'scorecard_checks_json',
  'openssf_score',
  'openssf_status',
  'openssf_scorecard_version',
  'openssf_score_date',
  'openssf_score_error',
  'openssf_score_fetched_at',
  'sbom_status',
  'sbom_fetched_at',
  'sbom_path',
  'sbom_error',
  'sbom_analysis_total_dependencies',
  'sbom_analysis_direct_dependencies_estimate',
  'sbom_analysis_transitive_dependencies_estimate',
  'sbom_analysis_dependencies_json',
  'vulnerability_summary_json',
  'vulnerability_analysis_status',
  'vulnerability_analysis_message',
  'vulnerability_analysis_analyzed',
  'classification_label',
  'classification_confidence',
  'classification_generic',
  'classification_specific',
  'classification_tags',
  'repo_dup_json',
  'dependency_summary_json',
  'description_short',
  'platform_metadata_json',
];

const GITHUB_FIELDS = [
  'stars',
  'forks',
  'openIssues',
  'watchers',
  'createdAt',
  'lastUpdated',
  'license',
  'language',
  'topics',
  'size',
  'defaultBranch',
  'archived',
  'disabled',
];

const SBOM_ANALYSIS_FIELDS = [
  'total_dependencies',
  'direct_dependencies_estimate',
  'transitive_dependencies_estimate',
  'dependencies',
];

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toJson(value) {
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function stripHtml(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.replace(/<[^>]*>/g, ' ');
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/&lt;/gi, '<');
  cleaned = cleaned.replace(/&gt;/gi, '>');
  cleaned = cleaned.replace(/&quot;/gi, '"');
  cleaned = cleaned.replace(/&#39;/gi, "'");
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function shorten(text, limit = 200) {
  if (!text) return '';
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}

function removeMappedFields(metadata) {
  const topLevelRemove = new Set([
    'id',
    'name',
    'platform',
    'author',
    'repo',
    'repository',
    'vendorUrl',
    'downloadUrl',
    'downloadStatsUpdated',
    'extensionId',
    'xmlId',
    'version',
    'publishedDate',
    'releaseDate',
    'lastUpdated',
    'users',
    'downloads',
    'rating',
    'ratingCount',
    'stars',
    'tags',
    'categories',
    'category',
    'source',
    'sourceId',
    'sources',
    'prFrictionMedianDays',
    'prFrictionSamples',
    'githubDataFetchedAt',
    'scorecard',
    'openssfScore',
    'openssfStatus',
    'openssfScorecardVersion',
    'openssfScoreDate',
    'openssfScoreError',
    'openssfScoreFetchedAt',
    'sbomStatus',
    'sbomFetchedAt',
    'sbomPath',
    'sbomError',
    'vulnerabilitySummary',
    'vulnerabilityAnalysis',
    'classification',
    'repoDup',
    'dependencySummary',
    'isTop100',
  ]);

  for (const key of Array.from(topLevelRemove)) {
    delete metadata[key];
  }

  if (metadata.githubStats && typeof metadata.githubStats === 'object') {
    for (const field of GITHUB_FIELDS) {
      delete metadata.githubStats[field];
    }
    if (Object.keys(metadata.githubStats).length === 0) {
      delete metadata.githubStats;
    }
  }

  if (metadata.sbom_analysis && typeof metadata.sbom_analysis === 'object') {
    for (const field of SBOM_ANALYSIS_FIELDS) {
      delete metadata.sbom_analysis[field];
    }
    if (Object.keys(metadata.sbom_analysis).length === 0) {
      delete metadata.sbom_analysis;
    }
  }
}

function buildRow(entry, platformFallback) {
  const github = entry.githubStats || {};
  const scorecard = entry.scorecard || {};
  const sbomAnalysis = entry.sbom_analysis || {};
  const vulnSummary = entry.vulnerabilitySummary;
  const vulnAnalysis = entry.vulnerabilityAnalysis || {};
  const classification = entry.classification || {};
  const classificationCategories = classification.categories || {};

  const descriptionShort = shorten(stripHtml(entry.description), 200);

  const metadata = JSON.parse(JSON.stringify(entry));
  removeMappedFields(metadata);
  const platformMetadataJson = Object.keys(metadata).length ? JSON.stringify(metadata) : '';

  return {
    top100_id: entry.id,
    plugin_name: entry.name,
    platform: entry.platform || platformFallback,
    author: entry.author,
    repo: entry.repo,
    repository: entry.repository,
    vendor_url: entry.vendorUrl,
    download_url: entry.downloadUrl,
    download_stats_updated: entry.downloadStatsUpdated,
    extension_id: entry.extensionId,
    xml_id: entry.xmlId,
    version: entry.version,
    published_date: entry.publishedDate,
    release_date: entry.releaseDate,
    last_updated: entry.lastUpdated,
    users: entry.users,
    downloads: entry.downloads,
    rating: entry.rating,
    rating_count: entry.ratingCount,
    stars: entry.stars,
    tags: toJson(entry.tags),
    categories: toJson(entry.categories),
    category: entry.category,
    source: entry.source,
    source_id: entry.sourceId,
    sources_json: toJson(entry.sources),
    pr_friction_median_days: entry.prFrictionMedianDays,
    pr_friction_samples: toJson(entry.prFrictionSamples),
    github_stars: github.stars,
    github_forks: github.forks,
    github_open_issues: github.openIssues,
    github_watchers: github.watchers,
    github_created_at: github.createdAt,
    github_last_updated: github.lastUpdated,
    github_license: github.license,
    github_language: github.language,
    github_topics: toJson(github.topics),
    github_size: github.size,
    github_default_branch: github.defaultBranch,
    github_archived: github.archived,
    github_disabled: github.disabled,
    github_data_fetched_at: entry.githubDataFetchedAt,
    scorecard_score: scorecard.score,
    scorecard_version: scorecard.scorecardVersion,
    scorecard_date: scorecard.scanDate,
    scorecard_check_scores_json: toJson(scorecard.checkScores),
    scorecard_checks_json: toJson(scorecard.checks),
    openssf_score: entry.openssfScore,
    openssf_status: entry.openssfStatus,
    openssf_scorecard_version: entry.openssfScorecardVersion,
    openssf_score_date: entry.openssfScoreDate,
    openssf_score_error: entry.openssfScoreError,
    openssf_score_fetched_at: entry.openssfScoreFetchedAt,
    sbom_status: entry.sbomStatus,
    sbom_fetched_at: entry.sbomFetchedAt,
    sbom_path: entry.sbomPath,
    sbom_error: entry.sbomError,
    sbom_analysis_total_dependencies: sbomAnalysis.total_dependencies,
    sbom_analysis_direct_dependencies_estimate: sbomAnalysis.direct_dependencies_estimate,
    sbom_analysis_transitive_dependencies_estimate: sbomAnalysis.transitive_dependencies_estimate,
    sbom_analysis_dependencies_json: toJson(sbomAnalysis.dependencies),
    vulnerability_summary_json: toJson(vulnSummary),
    vulnerability_analysis_status: vulnAnalysis.status,
    vulnerability_analysis_message: vulnAnalysis.message,
    vulnerability_analysis_analyzed: vulnAnalysis.analyzed,
    classification_label: classification.label,
    classification_confidence: classification.confidence,
    classification_generic: toJson(classificationCategories.generic),
    classification_specific: toJson(classificationCategories.specific),
    classification_tags: toJson(classification.tags),
    repo_dup_json: toJson(entry.repoDup),
    dependency_summary_json: toJson(entry.dependencySummary),
    description_short: descriptionShort,
    platform_metadata_json: platformMetadataJson,
  };
}

function main() {
  const rows = [];

  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const data = readJson(top100Path);
    if (!data || !Array.isArray(data.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }
    for (const entry of data.top100) {
      rows.push(buildRow(entry, platform));
    }
  }

  if (rows.length !== 900) {
    console.warn(`Expected 900 rows, found ${rows.length}`);
  }

  const lines = [];
  lines.push(COLUMNS.join(','));
  for (const row of rows) {
    const line = COLUMNS.map((col) => escapeCsv(row[col])).join(',');
    lines.push(line);
  }

  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
