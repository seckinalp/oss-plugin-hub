#!/usr/bin/env python3
"""
Fetch npm metadata (publish timestamps, latest version info, optional OSV vulns)
for dependencies listed in data/stale-deps-cache.json.

Reads the cache (keyed like "npm:package@version"), queries the npm registry for
each package, and writes an updated cache JSON enriched with:
  - publishedAt (current version)
  - latestVersion / latestPublishedAt
  - license, deprecated flag, repository, description
  - optional OSV vulnerability summary

Usage:
  python scripts/fetch_npm_published.py \
    --input data/stale-deps-cache.json \
    --output data/stale-deps-cache.npm_enriched.json \
    [--with-osv] [--with-scorecard] [--verbose]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Tuple, Optional
import re


def parse_key(key: str) -> Tuple[str, str] | None:
    """Return (package_name, version) from a cache key like 'npm:@scope/name@1.2.3'."""
    if not key.startswith("npm:"):
        return None
    body = key[4:]
    if "@" not in body:
        return None
    name, version = body.rsplit("@", 1)
    return name, version


def fetch_npm_metadata(name: str, version: str, retries: int = 3, delay: float = 0.2) -> Dict[str, str | None]:
    """Fetch publish timestamps and metadata for a package version from the npm registry."""
    url = f"https://registry.npmjs.org/{urllib.parse.quote(name)}"
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "stale-deps-fetcher/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
            time_map: Dict[str, str] = data.get("time") or {}
            versions_map: Dict[str, Dict] = data.get("versions") or {}
            version_entry: Dict = versions_map.get(version) or {}
            latest_version = (data.get("dist-tags") or {}).get("latest")
            latest_published = time_map.get(latest_version) if latest_version else None
            current_published = time_map.get(version) or time_map.get("modified") or time_map.get("created")
            license_val = version_entry.get("license") or version_entry.get("licenses")
            deprecated_flag = bool(version_entry.get("deprecated"))
            repo = None
            repo_entry = version_entry.get("repository") or {}
            if isinstance(repo_entry, str):
                repo = repo_entry
            elif isinstance(repo_entry, dict):
                repo = repo_entry.get("url") or repo_entry.get("git") or repo_entry.get("type")
            description = version_entry.get("description") or data.get("description")

            return {
                "publishedAt": current_published,
                "latestVersion": latest_version,
                "latestPublishedAt": latest_published,
                "license": license_val,
                "deprecated": deprecated_flag,
                "repository": repo,
                "description": description,
            }
        except urllib.error.HTTPError as e:
            last_error = e
            # backoff lightly on server/ratelimit errors
            if e.code in {429, 500, 502, 503, 504}:
                time.sleep(delay * attempt)
                continue
            break
        except Exception as e:  # noqa: BLE001
            last_error = e
            time.sleep(delay * attempt)
            continue
    sys.stderr.write(f"[warn] npm fetch failed {name}@{version}: {last_error}\n")
    return {}


def severity_from_osv(vuln: Dict) -> float:
    """Return a numeric severity proxy (higher worse) from an OSV vuln record."""
    sev_list = vuln.get("severity") or []
    best = 0.0
    for sev in sev_list:
        if sev.get("type", "").upper().startswith("CVSS") and sev.get("score"):
            try:
                score = float(sev["score"].split("/")[0]) if isinstance(sev["score"], str) else float(sev["score"])
                best = max(best, score)
            except Exception:
                continue
    return best


def bucket_from_cvss(score: float) -> str:
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    if score > 0:
        return "low"
    return "none"


def fetch_osv(name: str, version: str, retries: int = 3, delay: float = 0.2) -> Dict:
    """Query OSV for npm package+version vulnerability summary."""
    url = "https://api.osv.dev/v1/query"
    payload = json.dumps({"package": {"name": name, "ecosystem": "npm"}, "version": version}).encode("utf-8")
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "stale-deps-fetcher/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
            vulns = data.get("vulns") or []
            if not vulns:
                return {"vuln_count": 0, "highest_severity": "none"}
            scores = [severity_from_osv(v) for v in vulns]
            best = max(scores) if scores else 0
            return {
                "vuln_count": len(vulns),
                "highest_severity": bucket_from_cvss(best),
            }
        except urllib.error.HTTPError as e:
            last_error = e
            if e.code in {429, 500, 502, 503, 504}:
                time.sleep(delay * attempt)
                continue
            break
        except Exception as e:  # noqa: BLE001
            last_error = e
            time.sleep(delay * attempt)
            continue
    sys.stderr.write(f"[warn] OSV fetch failed {name}@{version}: {last_error}\n")
    return {"vuln_count": None, "highest_severity": "unknown"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Fill npm publishedAt values and metadata in stale-deps cache")
    ap.add_argument("--input", default="data/stale-deps-cache.json", help="Path to input cache JSON")
    ap.add_argument(
        "--output",
        default="data/stale-deps-cache.npm_enriched.json",
        help="Path to write updated cache JSON",
    )
    ap.add_argument("--sleep", type=float, default=0.1, help="Sleep between requests (seconds)")
    ap.add_argument("--with-osv", action="store_true", help="Query OSV for vulnerability summary")
    ap.add_argument("--with-scorecard", action="store_true", help="Fetch OpenSSF Scorecard for GitHub repos")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of packages processed (for testing)")
    ap.add_argument("--verbose", action="store_true", help="Log every processed item to stderr")
    args = ap.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    verbose = args.verbose

    data = json.loads(input_path.read_text(encoding="utf-8"))

    items = list(data.items())
    if args.limit is not None:
        items = items[: args.limit]
    total = len(items)
    updated = 0
    skipped = 0

    for idx, (key, value) in enumerate(items, start=1):
        parsed = parse_key(key)
        if not parsed:
            continue
        name, version = parsed
        has_meta = (
            value.get("publishedAt")
            and value.get("latestVersion")
            and value.get("latestPublishedAt")
            and ("security" in value or not args.with_osv)
        )
        if has_meta:
            skipped += 1
            if verbose:
                sys.stderr.write(f"[skip] {name}@{version} already enriched\n")
            continue

        meta = fetch_npm_metadata(name, version)
        status = "error"
        if meta:
            value.setdefault("publishedAt", meta.get("publishedAt"))
            value.setdefault("latestVersion", meta.get("latestVersion"))
            value.setdefault("latestPublishedAt", meta.get("latestPublishedAt"))
            value.setdefault("license", meta.get("license"))
            value.setdefault("deprecated", meta.get("deprecated"))
            value.setdefault("repository", meta.get("repository"))
            value.setdefault("description", meta.get("description"))
            value["status"] = "ok"
            updated += 1
            status = "ok"
        else:
            value["status"] = "error"
            status = "error"

        if args.with_osv:
            osv = fetch_osv(name, version)
            value["security"] = osv
        if args.with_scorecard:
            # Try to normalize repository to GitHub form
            repo_url = value.get("repository") or meta.get("repository") if meta else None
            gh = None
            if repo_url and isinstance(repo_url, str):
                gh = normalize_github_repo(repo_url)
            if gh:
                scorecard = fetch_scorecard(gh)
                if scorecard:
                    value["openssf_scorecard"] = scorecard
            elif repo_url:
                value["openssf_scorecard"] = {"score": None, "note": "non-github-repo"}
            else:
                value["openssf_scorecard"] = {"score": None, "note": "missing-repo"}
        if verbose:
            osv_info = ""
            if args.with_osv and value.get("security"):
                sec = value["security"]
                osv_info = f" osv_count={sec.get('vuln_count')} sev={sec.get('highest_severity')}"
            scorecard_info = ""
            if args.with_scorecard and value.get("openssf_scorecard"):
                sc = value["openssf_scorecard"]
                scorecard_info = f" scorecard={sc.get('score')}"
            sys.stderr.write(
                f"[{status}] {name}@{version} published={value.get('publishedAt')} "
                f"latest={value.get('latestVersion')} latestAt={value.get('latestPublishedAt')}{osv_info}{scorecard_info}\n"
            )
        data[key] = value

        # simple progress indicator
        if idx % 200 == 0 or idx == total:
            sys.stderr.write(f"[progress] {idx}/{total} processed, updated {updated}, skipped {skipped}\n")
        time.sleep(args.sleep)

    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.stderr.write(f"[done] wrote {output_path} (updated {updated}, skipped {skipped}, total {total})\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
