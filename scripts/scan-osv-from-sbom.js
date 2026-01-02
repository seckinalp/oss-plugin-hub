import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SBOM_DIR = path.join(__dirname, '../data/sbom');
const OUTPUT_DIR = path.join(__dirname, '../data/osv-scans');

const USE_DOCKER = process.argv.includes('--docker');
const FORCE = process.argv.includes('--force');
const FLUSH_EACH = process.argv.includes('--flush-each');
const IMAGE_ARG = process.argv.find((a) => a.startsWith('--image=')) ||
  process.argv.find((a) => a.startsWith('--docker-image='));
const DOCKER_IMAGE = (() => {
  if (IMAGE_ARG) {
    const [, val] = IMAGE_ARG.split('=');
    return val || null;
  }
  const idx = process.argv.indexOf('--image');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const idx2 = process.argv.indexOf('--docker-image');
  if (idx2 !== -1 && idx2 + 1 < process.argv.length) {
    return process.argv[idx2 + 1];
  }
  return process.env.OSV_SCANNER_IMAGE || 'ghcr.io/google/osv-scanner:latest';
})();
const KEEP_TEMP = process.argv.includes('--keep-temp');

const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = (() => {
  if (LIMIT_ARG) {
    const v = parseInt(LIMIT_ARG.split('=')[1], 10);
    return Number.isFinite(v) ? v : null;
  }
  const idx = process.argv.indexOf('--limit');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const v = parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(v) ? v : null;
  }
  return null;
})();

const PATTERN_ARG = process.argv.find((a) => a.startsWith('--pattern='));
const PATTERN = (() => {
  if (PATTERN_ARG) {
    return PATTERN_ARG.split('=')[1];
  }
  const idx = process.argv.indexOf('--pattern');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return '';
})();

function ensureDirs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function listSboms() {
  const files = fs.readdirSync(SBOM_DIR).filter((f) => f.endsWith('.sbom.json'));
  files.sort();
  if (PATTERN) {
    return files.filter((f) => f.toLowerCase().includes(PATTERN.toLowerCase()));
  }
  return files;
}

function detectFormat(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf8').slice(0, 2048);
    if (head.includes('"spdxVersion"')) return 'spdx.json';
    if (head.includes('"bomFormat"') && head.includes('CycloneDX')) return 'cdx.json';
  } catch (_) {
    // ignore
  }
  return null;
}

function filterGithubActionsPackages(sourcePath, containerPath) {
  try {
    const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const packages = data.packages;
    if (!Array.isArray(packages)) return null;
    const filtered = packages.filter((p) => {
      const refs = p?.externalRefs || p?.externalReferences;
      if (!Array.isArray(refs)) return true;
      return !refs.some((r) => {
        const locator = r.locator || r.referenceLocator || '';
        return typeof locator === 'string' && locator.toLowerCase().includes('pkg:githubactions/');
      });
    });
    if (filtered.length === packages.length) return null; // nothing removed
    const clone = { ...data, packages: filtered };
    // overwrite the same temp file so extension stays valid (.spdx.json or .cdx.json)
    fs.writeFileSync(sourcePath, JSON.stringify(clone, null, 2));
    return { pathHost: sourcePath, pathContainer: containerPath, tempPath: sourcePath };
  } catch (_) {
    return null;
  }
}

function prepareInput(sbomFile) {
  const originalPath = path.join(SBOM_DIR, sbomFile);
  const fmt = detectFormat(originalPath);
  if (!fmt) {
    // Still attempt to strip GH Actions if present
    filterGithubActionsPackages(originalPath, `/sboms/${sbomFile}`);
    return { pathHost: originalPath, pathContainer: `/sboms/${sbomFile}`, tempPath: null };
  }

  const tmpName = sbomFile.replace(/\.sbom\.json$/i, `.${fmt}`);
  const tmpPath = path.join(SBOM_DIR, tmpName);
  fs.copyFileSync(originalPath, tmpPath);
  // strip GH Actions upfront
  filterGithubActionsPackages(tmpPath, `/sboms/${tmpName}`);
  return { pathHost: tmpPath, pathContainer: `/sboms/${tmpName}`, tempPath: tmpPath };
}

function runCommand(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const code = res.status;
  // OSV uses exit code 1 when vulnerabilities are found; treat 0 or 1 as usable
  if (code !== null && code > 1) {
    const err = new Error(`Command failed with code ${code}`);
    err.stdout = stdout;
    err.stderr = stderr;
    // Add debug info
    if (process.env.DEBUG) {
      console.error(`  Command: ${cmd} ${args.join(' ')}`);
      console.error(`  stdout: ${stdout}`);
      console.error(`  stderr: ${stderr}`);
    }
    throw err;
  }
  return stdout || stderr;
}

function runScanner(sbomFile) {
  const prep = prepareInput(sbomFile);
  const inputPathHost = prep.pathHost;
  const inputPathContainer = prep.pathContainer;

  const runOnce = (pathHost, pathContainer) => {
    if (USE_DOCKER) {
      // Convert Windows path to Docker-compatible format
      let dockerPath = SBOM_DIR;
      if (process.platform === 'win32') {
        // Convert C:\path\to\dir to /c/path/to/dir
        dockerPath = dockerPath.replace(/\\/g, '/');
        if (dockerPath.match(/^[A-Z]:/i)) {
          dockerPath = '/' + dockerPath.charAt(0).toLowerCase() + dockerPath.slice(2);
        }
      }
      
      const args = [
        'run',
        '--rm',
        '-v',
        `${dockerPath}:/sboms`,
        DOCKER_IMAGE,
        '--format',
        'json',
        '--sbom',
        pathContainer,
      ];
      return runCommand('docker', args);
    }
    const scanner = process.env.OSV_SCANNER_CMD || 'osv-scanner';
    return runCommand(scanner, ['--format', 'json', '--sbom', pathHost]);
  };

  try {
    const output = runOnce(inputPathHost, inputPathContainer);
    if (prep.tempPath && !KEEP_TEMP) fs.unlink(prep.tempPath, () => {});
    return output;
  } catch (err) {
    if (prep.tempPath && !KEEP_TEMP) fs.unlink(prep.tempPath, () => {});
    throw err;
  }
}

function main() {
  ensureDirs();

  const sboms = listSboms();
  const target = LIMIT ? sboms.slice(0, LIMIT) : sboms;

  console.log(`OSV scan for SBOMs`);
  console.log(`  Input dir: ${SBOM_DIR}`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);
  console.log(`  Mode: ${USE_DOCKER ? `docker (${DOCKER_IMAGE})` : 'local cli'}`);
  if (LIMIT) console.log(`  Limit: ${LIMIT}`);
  if (PATTERN) console.log(`  Pattern: ${PATTERN}`);
  if (FORCE) console.log(`  Force: overwrite existing outputs`);
  if (FLUSH_EACH) console.log(`  Flush: save after each file`);
  console.log('');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const sbomFile of target) {
    const outFile = path.join(OUTPUT_DIR, sbomFile.replace(/\.sbom\.json$/i, '.osv.json'));
    if (!FORCE && fs.existsSync(outFile)) {
      skipped += 1;
      continue;
    }

    console.log(`Scanning ${sbomFile} ...`);
    try {
      const output = runScanner(sbomFile);
      fs.writeFileSync(outFile, output);
      processed += 1;
      if (FLUSH_EACH) {
        fs.writeFileSync(outFile, output);
      }
    } catch (err) {
      failed += 1;
      console.log(`  ✖ Error on ${sbomFile}: ${err.message}`);
      if (err.stdout) {
        try {
          fs.writeFileSync(outFile + '.error.txt', err.stdout);
        } catch (_) {
          // ignore
        }
      }
    }
  }

  console.log('\nSummary:');
  console.log(`  Scanned: ${processed}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

main();
