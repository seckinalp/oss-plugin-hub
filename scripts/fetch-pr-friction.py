#!/usr/bin/env python3
"""
Fetch PR friction (median external PR turnaround) for all repos in top100 lists.

Uses GH_TOKEN from environment. Caches per-repo results to data/pr-friction-cache.json
so runs can resume after rate limits/timeouts.
"""
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from statistics import median

# Ensure stdout handles unicode safely on Windows
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_FILE = DATA_DIR / "pr-friction-cache.json"
MAX_PAGES = int(os.environ.get("PR_MAX_PAGES") or 5)  # per repo
PER_PAGE = 100
SLEEP_BETWEEN_CALLS = float(os.environ.get("PR_SLEEP") or 0.5)


def load_top100_repos() -> set[str]:
    platforms = [
        "chrome",
        "firefox",
        "homeassistant",
        "jetbrains",
        "minecraft",
        "obsidian",
        "sublime",
        "vscode",
        "wordpress",
    ]
    repos = set()
    for plat in platforms:
        path = DATA_DIR / plat / "top100.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("top100", []):
            repo = item.get("repo")
            if repo and "/" in repo:
                # normalize like owner/repo
                repos.add(repo.strip().replace(".git", ""))
    return repos


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def gh_request(url: str, token: str):
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "oss-plugin-hub/pr-friction")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
        return json.loads(data), resp.headers


def fetch_pr_durations(owner: str, repo: str, token: str) -> list[float]:
    durations = []
    for page in range(1, MAX_PAGES + 1):
        query = urllib.parse.urlencode(
            {
                "state": "closed",
                "sort": "created",
                "direction": "desc",
                "per_page": PER_PAGE,
                "page": page,
            }
        )
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls?{query}"
        try:
            payload, _ = gh_request(url, token)
        except urllib.error.HTTPError as e:
            # rate limits or missing repo; stop gracefully
            if e.code == 403:
                raise
            else:
                break
        except Exception:
            break

        if not isinstance(payload, list) or len(payload) == 0:
            break

        for pr in payload:
            user = (pr.get("user") or {}).get("login", "")
            # external PR if author != repo owner
            if user.lower() == owner.lower():
                continue
            created = pr.get("created_at")
            closed = pr.get("closed_at") or pr.get("merged_at")
            if not created or not closed:
                continue
            try:
                t_created = time.strptime(created, "%Y-%m-%dT%H:%M:%SZ")
                t_closed = time.strptime(closed, "%Y-%m-%dT%H:%M:%SZ")
                dt = time.mktime(t_closed) - time.mktime(t_created)
                durations.append(dt / 86400.0)  # days
            except Exception:
                continue
        # be polite
        time.sleep(SLEEP_BETWEEN_CALLS)
    return durations


def main():
    token = os.environ.get("GH_TOKEN")
    if not token:
        print("GH_TOKEN not set; aborting.", file=sys.stderr)
        sys.exit(1)

    repos = load_top100_repos()
    cache = load_cache()

    for repo in sorted(repos):
        if repo in cache and cache[repo].get("status") == "ok":
            continue
        owner, name = repo.split("/", 1)
        print(f"Processing {repo} ...", flush=True)
        try:
            durations = fetch_pr_durations(owner, name, token)
        except urllib.error.HTTPError as e:
            print(f"  HTTP error {e.code} on {repo}, caching as error", file=sys.stderr)
            cache[repo] = {"status": "error", "error": f"HTTP {e.code}"}
            save_cache(cache)
            continue
        except Exception as e:
            print(f"  Error {e} on {repo}, caching as error", file=sys.stderr)
            cache[repo] = {"status": "error", "error": str(e)}
            save_cache(cache)
            continue

        if durations:
            med = median(durations)
            cache[repo] = {
                "status": "ok",
                "medianDays": round(med, 2),
                "count": len(durations),
            }
        else:
            cache[repo] = {"status": "no-data"}
        save_cache(cache)


if __name__ == "__main__":
    main()
