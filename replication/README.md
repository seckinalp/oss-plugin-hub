Replication Package README

Overview
- This replication package reproduces all tables in replication/final.tex using static data in replication/data.
- Notebooks are under replication/notebooks and run without network access.
- Scripts are included for transparency and to re-run the data pipeline if needed (they require network access and API tokens).

Directory layout
- replication/data/                Static data used by notebooks
- replication/notebooks/           Jupyter notebooks that reproduce all tables
- replication/scripts/             Data collection and analysis scripts
- replication/final.tex            Final paper used for table matching
- replication/env.example          Example environment variables
- replication/requirement.txt      Python dependencies for notebooks

Python requirements
- Install (from replication/):
  pip install -r requirement.txt

Notebook execution (no network)
- Run all notebooks (from repo root):
  python -m nbconvert --to notebook --execute --ExecutePreprocessor.timeout=600 --inplace replication\notebooks\*.ipynb
- Each notebook starts by loading data only from replication/data.
- Output tables match the LaTeX tables in replication/final.tex.

Data sources used by notebooks
- replication/data/platforms/*/top100.json
- replication/data/platform-counts.json
- replication/data/platform-star-concentration-size.json
- replication/data/platforms/analytics-summary.json
- replication/data/classification/classifications_groq.json
- replication/data/sbom + osv/osv-scans/*.analysis.json
- replication/data/scorecard/scorecard-platform-summary.json (reference only)

Scripts overview

1.fetch (marketplace snapshots and download stats)
- fetch-firefox-addons.js
- fetch-homeassistant-components.js
- fetch-jetbrains-plugins.js
- fetch-modrinth-mods.js
- fetch-obsidian-plugins.js
- fetch-sublime-plugins.js
- fetch-vscode-plugins.js
- fetch-wordpress-plugins.js
Notes:
- These scripts fetch marketplace metadata and download/install counts.
- Output typically lands under replication/data/<platform>/ (and may include metadata.json, plugins.json, top100.json).
- The build step later normalizes to replication/data/platforms/<platform>/top100.json.

Manual download stats fallback (if fetch fails or data is missing)

Default download stats sources (used by fetch scripts and manual download)
- Chrome Web Store stats: https://cws-database.com/
- Firefox AMO stats: https://addons.mozilla.org/en-US/firefox/extensions/
- VS Code Marketplace API: https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery
- JetBrains Marketplace: https://plugins.jetbrains.com/
- WordPress Plugin Directory: https://wordpress.org/plugins/
- Modrinth: https://modrinth.com/
- Obsidian plugins: https://obsidian.md/plugins
- Home Assistant (HACS / integrations): https://www.home-assistant.io/integrations/
- Sublime Package Control: https://packagecontrol.io/stats


2.top100dataprepare (Top100 build, GitHub, analytics)
- generate-top100.js
  - Builds top100.json from plugins.json and download stats (adds downloads + isTop100 flags).
  - Use --offline to skip remote download stats (uses existing fields only).
- update-github-stats.js
  - Fetches GitHub repo metadata and enriches top100.json.
- generate-github-analytics.js
  - Aggregates GitHub metrics into replication/data/platforms/analytics-summary.json.
- generate-analytics-summary.js
  - Builds the cross-platform analytics summary (downloads, issue density, abandonment, deps, SBOM/OSV coverage).
- generate-top100-coverage-summary.js
  - Builds top100 coverage summary (repo coverage stats, QA).
- update-top100-dependencies.py
  - Fetches dependency manifests from GitHub to update dependency counts in top100.json.
- analyze-repo-duplicates.js
  - Generates repo-duplication analysis used by build-final-top100.js.
- build-final-top100.js
  - Merges classification, repo-duplication, SBOM, OSV, and scorecard data into top100.json.

3.sbom + osv (SBOM fetch + OSV analysis)
- fetch-sbom.js
  - Uses GitHub dependency graph to fetch SBOMs for repos in top100.json.
- scan-osv-from-sbom.js
  - Runs osv-scanner against SBOMs; produces *.osv.json files.
- run-sbom-osv-analysis.js
  - Generates *.analysis.json, vulnerability-summary.json, and updates top100.json with vulnerabilityAnalysis.

4.scorecard (OpenSSF Scorecard)
- run-scorecard-from-top100.js
  - Runs the Scorecard CLI for each repo and stores raw JSON in scorecard-local/.
- generate-scorecard-platform-summary.js
  - Produces replication/data/scorecard/scorecard-platform-summary.json.

5.classification (LLM-assisted labeling)
- fetch-readmes.js
  - Fetches README content for top100 repos and stores under replication/data/classification/readmes.
- classify_with_groq.py
  - LLM-based classification for generic and platform-specific categories.
- generate-classification-summary.js
  - Creates replication/data/classification/classifications-summary.json.
LLM artifacts
- Model: meta-llama/llama-4-scout-17b-16e-instruct (defined in replication/scripts/5.classification/classify_with_groq.py).
- Prompts: constructed in classify_with_groq.py (build_prompt) using inputs from replication/data/platforms/*/top100.json and replication/data/classification/readmes/*.
- Responses: stored as raw classifications in replication/data/classification/classifications_groq.json.

6.pluginsmastertable (900 plugins master table)
- build-plugins-master-table.js
  - Builds the 900-row master table from all top100.json files.
- analyze_plugins_master_table.py
  - Computes descriptive stats and QA checks for the master table.
Notes:
- These scripts support intermediate aggregations or QA; they are not required for notebook execution.
- top100.json is a required input for GitHub, SBOM/OSV, scorecard, and analytics; it is created by generate-top100.js.

Environment variables
- GH_TOKEN or GITHUB_TOKEN: GitHub API access (SBOM fetch, GitHub stats, README fetch).
- GROQ_API: Groq API key for classification (only needed for re-running LLM labeling).

External tools (optional, only for data re-collection)
- OSV Scanner: https://github.com/google/osv-scanner
- OpenSSF Scorecard CLI: https://github.com/ossf/scorecard

Contact / notes
- All tables in replication/final.tex are reproduced by notebooks in replication/notebooks using the static data in replication/data.
