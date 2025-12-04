#!/usr/bin/env python3
"""
Fetch dependency publish dates to estimate staleness.

Currently supports npm packages only (from package.json style names).
For each top100 plugin's dependencies/devDependencies, fetch the publish time
for the declared version from the npm registry and mark stale if older than 1 year.

Outputs:
- data/stale-deps-cache.json : per-package version publish times and stale flag
- prints per-platform avgStaleDepRatio (stale/total deps with publish dates)

NOTE: This does not write back into analytics-summary.json automatically.
"""

import json
import math
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_FILE = DATA_DIR / "stale-deps-cache.json"
RESULTS_FILE = DATA_DIR / "stale-deps-results.json"
PLATFORMS = [
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
SLEEP_BETWEEN_CALLS = float(os.environ.get("STALE_SLEEP") or 0)

# Simple heuristic: npm packages usually contain characters allowed in package names
def is_npm_package(name: str) -> bool:
    if not name:
        return False
    # skip git/github specs
    if name.startswith("github:") or "://" in name:
        return False
    # scoped or plain package
    return True


def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def load_results():
    if RESULTS_FILE.exists():
        return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
    return {}


def save_results(results):
    RESULTS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def npm_publish_time(package: str, version: str, cache: dict):
    key = f"npm:{package}@{version}"
    if key in cache:
        return cache[key]

    url = f"https://registry.npmjs.org/{package}/{version}"
    req = Request(url, headers={"User-Agent": "oss-plugin-hub/stale-deps"})
    try:
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            # try dist-tags time
            time_str = None
            if "time" in data and isinstance(data["time"], dict):
                time_str = data["time"].get("created") or data["time"].get("publish_time")
            if not time_str:
                # fallback to date field if present
                time_str = data.get("date")
            cache[key] = {"status": "ok", "publishedAt": time_str}
            if SLEEP_BETWEEN_CALLS:
                time.sleep(SLEEP_BETWEEN_CALLS)
            return cache[key]
    except HTTPError as e:
        cache[key] = {"status": "error", "code": e.code}
    except URLError as e:
        cache[key] = {"status": "error", "err": str(e.reason)}
    except Exception as e:
        cache[key] = {"status": "error", "err": str(e)}
    return cache[key]


def main():
    cache = load_cache()
    results = load_results()
    platform_filter = os.environ.get("STALE_PLATFORMS")
    if platform_filter:
        target_platforms = [p.strip() for p in platform_filter.split(",") if p.strip()]
    else:
        target_platforms = PLATFORMS

    one_year = timedelta(days=365)

    for plat in target_platforms:
        path = DATA_DIR / plat / "top100.json"
        if not path.exists():
            continue
        print(f"Platform: {plat}", flush=True)
        top = json.loads(path.read_text(encoding="utf-8")).get("top100", [])
        stale = 0
        total = 0

        for item in top:
            deps = (item.get("githubStats") or {}).get("dependencies") or {}
            for section in ("dependencies", "devDependencies"):
                section_deps = deps.get(section) or {}
                for pkg, ver in section_deps.items():
                    if not is_npm_package(pkg):
                        continue
                    total += 1
                    cache_key = f"npm:{pkg}@{ver.lstrip('^~')}"
                    if cache_key not in cache:
                        print(f"  {plat}: {pkg}@{ver}", flush=True)
                    rec = npm_publish_time(pkg, ver.lstrip("^~"), cache)
                    pub = rec.get("publishedAt")
                    if pub:
                        try:
                            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                            if datetime.now(timezone.utc) - dt > one_year:
                                stale += 1
                        except Exception:
                            pass
        ratio = (stale / total) if total else 0
        results[plat] = {"stale": stale, "total": total, "avgStaleDepRatio": round(ratio, 3)}
        save_results(results)
        save_cache(cache)
        print(f"{plat}: stale {stale} / {total} avgStaleDepRatio {results[plat]['avgStaleDepRatio']}")

    save_cache(cache)
    save_results(results)
    print("Cache saved to", CACHE_FILE)
    print("Results saved to", RESULTS_FILE)


if __name__ == "__main__":
    main()
