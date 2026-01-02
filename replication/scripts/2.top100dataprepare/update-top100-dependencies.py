import argparse
import base64
import json
import os
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
GITHUB_API = "https://api.github.com"


def load_env_token():
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    if not ENV_PATH.exists():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in ("GH_TOKEN", "GITHUB_TOKEN"):
            return value.strip()
    return ""


def parse_repo(repo):
    if not repo:
        return None
    repo = repo.strip()
    repo = re.sub(r"^https?://github\.com/", "", repo, flags=re.IGNORECASE)
    repo = repo.replace(".git", "")
    parts = repo.split("/")
    if len(parts) < 2:
        return None
    return parts[0], parts[1]


def fetch_content(owner, repo, path, token):
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    headers = {
        "User-Agent": "oss-plugin-hub/deps-refresh",
        "Accept": "application/vnd.github.v3+json",
    }
    if token:
        headers["Authorization"] = f"token {token}"
    req = Request(url, headers=headers)
    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as err:
        if err.code in (403, 404):
            return None
        raise
    if not data or "content" not in data:
        return None
    return base64.b64decode(data["content"]).decode("utf-8", errors="replace")


def normalize_dep(dep):
    dep = dep.strip().strip("\"'")
    if ":" in dep:
        parts = dep.split(":")
        if len(parts) >= 2:
            return f"{parts[0]}:{parts[1]}"
    return dep


def is_dev_config(config):
    cfg = config.lower()
    if cfg.startswith("test"):
        return True
    return cfg in {
        "androidtestimplementation",
        "androidtestcompile",
        "androidtestruntimeonly",
        "testfixturesimplementation",
        "testfixturesapi",
        "testannotationprocessor",
        "testkapt",
    }


def parse_gradle(content):
    prod = set()
    dev = set()
    in_deps = False
    brace_depth = 0

    for raw_line in content.splitlines():
        line = re.sub(r"//.*", "", raw_line).strip()
        if not line:
            continue
        if not in_deps:
            if re.match(r"^dependencies\s*\{", line):
                in_deps = True
                brace_depth = line.count("{") - line.count("}")
                if brace_depth <= 0:
                    in_deps = False
            continue

        brace_depth += line.count("{") - line.count("}")
        if brace_depth <= 0:
            in_deps = False
            continue

        match = re.match(r"^([A-Za-z][\w]*)\s+['\"]([^'\"]+)['\"]", line)
        if not match:
            match = re.match(r"^([A-Za-z][\w]*)\s*\(\s*['\"]([^'\"]+)['\"]", line)
        if match:
            config, dep = match.group(1), match.group(2)
            dep_id = normalize_dep(dep)
        else:
            match = re.match(r"^([A-Za-z][\w]*)\s*\(\s*([^)]+)\)", line)
            if not match:
                continue
            config, dep = match.group(1), match.group(2).strip()
            dep_compact = dep.replace(" ", "")
            if dep_compact.startswith(("project(", "platform(", "enforcedPlatform(", "files(")):
                continue
            dep_id = normalize_dep(dep_compact)

        if not dep_id:
            continue
        if is_dev_config(config):
            dev.add(dep_id)
        else:
            prod.add(dep_id)

    return prod, dev


def parse_maven(content):
    prod = set()
    dev = set()
    in_dep_mgmt = False
    in_dep = False
    group_id = None
    artifact_id = None
    scope = None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if "<dependencyManagement" in line:
            in_dep_mgmt = True
        if in_dep_mgmt and "</dependencyManagement" in line:
            in_dep_mgmt = False
            continue
        if in_dep_mgmt:
            continue

        if "<dependency>" in line:
            in_dep = True
            group_id = None
            artifact_id = None
            scope = None
            continue

        if in_dep:
            if "<groupId>" in line:
                group_id = re.sub(r".*<groupId>(.*?)</groupId>.*", r"\1", line).strip()
            if "<artifactId>" in line:
                artifact_id = re.sub(r".*<artifactId>(.*?)</artifactId>.*", r"\1", line).strip()
            if "<scope>" in line:
                scope = re.sub(r".*<scope>(.*?)</scope>.*", r"\1", line).strip()
            if "</dependency>" in line:
                if group_id and artifact_id:
                    key = f"{group_id}:{artifact_id}"
                    if scope and scope.lower() == "test":
                        dev.add(key)
                    else:
                        prod.add(key)
                in_dep = False

    return prod, dev


def get_dependencies(owner, repo, token):
    content = fetch_content(owner, repo, "package.json", token)
    if content:
        try:
            pkg = json.loads(content)
            deps = pkg.get("dependencies") or {}
            dev = pkg.get("devDependencies") or {}
            return set(deps.keys()), set(dev.keys())
        except json.JSONDecodeError:
            pass

    for gradle_file in ("build.gradle.kts", "build.gradle"):
        content = fetch_content(owner, repo, gradle_file, token)
        if content:
            prod, dev = parse_gradle(content)
            if prod or dev:
                return prod, dev

    content = fetch_content(owner, repo, "pom.xml", token)
    if content:
        prod, dev = parse_maven(content)
        if prod or dev:
            return prod, dev

    return set(), set()


def update_platform(platform, token, delay):
    top_path = DATA_DIR / platform / "top100.json"
    if not top_path.exists():
        print(f"Missing {platform}/top100.json, skipping.")
        return 0

    data = json.loads(top_path.read_text(encoding="utf-8"))
    updated = 0

    for plugin in data.get("top100", []):
        repo = plugin.get("repo")
        parsed = parse_repo(repo)
        if not parsed:
            continue
        owner, name = parsed
        prod, dev = get_dependencies(owner, name, token)
        if not prod and not dev:
            continue
        stats = plugin.get("githubStats") or {}
        stats["dependencies"] = {
            "dependencies": {k: "*" for k in sorted(prod)},
            "devDependencies": {k: "*" for k in sorted(dev)},
        }
        plugin["githubStats"] = stats
        updated += 1
        if delay > 0:
            time.sleep(delay)

    top_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"{platform}: updated dependencies for {updated} repos")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Update top100 dependency counts from build manifests.")
    parser.add_argument("--platform", help="Comma-separated platforms", default="jetbrains,minecraft")
    parser.add_argument("--delay", type=float, default=0.1)
    args = parser.parse_args()

    token = load_env_token()
    platforms = [p.strip() for p in args.platform.split(",") if p.strip()]
    total = 0
    for platform in platforms:
        total += update_platform(platform, token, args.delay)
    print(f"Total updated repos: {total}")


if __name__ == "__main__":
    main()
