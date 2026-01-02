import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from groq import Groq

GENERIC_CATEGORIES = [
    "privacy_security",
    "performance_optimization",
    "productivity_workflow",
    "ui_customization",
    "navigation_search",
    "integrations_connectors",
    "data_storage_backup",
    "monitoring_observability",
    "automation_workflow",
    "developer_tools",
    "language_support",
    "code_quality_linting",
    "testing_debugging",
    "build_ci_cd",
    "documentation_templates",
    "content_media",
    "accessibility",
    "education_reference",
    "ecommerce_payments",
    "seo_marketing",
    "gaming_modding",
    "iot_smart_home",
    "utilities_misc",
]

PLATFORM_CATEGORIES = {
    "chrome": [
        "ad_blocking_privacy",
        "security_authentication",
        "productivity_workflow",
        "tabs_bookmarks_management",
        "customization_theming",
        "social_communication",
        "media_entertainment",
        "shopping_price_tracking",
        "developer_tools",
        "translation_language",
        "accessibility",
        "education_reference",
        "integrations_connectors",
        "utilities_misc",
    ],
    "firefox": [
        "privacy_security",
        "ad_blocking_content_filtering",
        "productivity_workflow",
        "tabs_bookmarks_management",
        "customization_theming",
        "social_communication",
        "media_entertainment",
        "shopping_price_tracking",
        "developer_tools",
        "translation_language",
        "accessibility",
        "education_reference",
        "integrations_connectors",
        "utilities_misc",
    ],
    "homeassistant": [
        "device_integration",
        "dashboard_ui_cards",
        "automation_workflow",
        "monitoring_alerting",
        "energy_environment",
        "security_safety",
        "media_entertainment",
        "networking_connectivity",
        "data_storage_backup",
        "performance_optimization",
        "utilities_misc",
    ],
    "jetbrains": [
        "ide_productivity",
        "language_support",
        "code_quality_linting",
        "testing_debugging",
        "build_ci_cd",
        "vcs_collaboration",
        "ui_ux_theming",
        "navigation_search",
        "documentation_snippets",
        "integrations_connectors",
        "database_tools",
        "performance_optimization",
        "utilities_misc",
    ],
    "minecraft": [
        "gameplay_mechanics",
        "world_generation",
        "performance_optimization",
        "graphics_visuals",
        "ui_quality_of_life",
        "items_blocks",
        "mobs_entities",
        "automation_tech",
        "magic_rpg",
        "multiplayer_server",
        "mod_framework_library",
        "utilities_misc",
    ],
    "obsidian": [
        "note_taking_writing",
        "organization_tagging",
        "knowledge_management",
        "productivity_workflow",
        "ui_customization",
        "data_visualization",
        "task_project_management",
        "templates_snippets",
        "integrations_connectors",
        "publishing_sharing",
        "developer_tools",
        "utilities_misc",
    ],
    "sublime": [
        "language_support",
        "code_quality_linting",
        "formatting_styling",
        "navigation_search",
        "ui_theming",
        "productivity_workflow",
        "build_run_tools",
        "testing_debugging",
        "snippets_templates",
        "vcs_collaboration",
        "utilities_misc",
    ],
    "vscode": [
        "language_support",
        "code_quality_linting",
        "formatting_styling",
        "testing_debugging",
        "build_ci_cd",
        "vcs_collaboration",
        "ui_theming",
        "navigation_search",
        "snippets_templates",
        "cloud_remote_dev",
        "integrations_connectors",
        "productivity_workflow",
        "utilities_misc",
    ],
    "wordpress": [
        "seo_marketing",
        "ecommerce_payments",
        "security_privacy",
        "performance_caching",
        "analytics_tracking",
        "content_editor_blocks",
        "design_themes_ui",
        "forms_leads",
        "backups_migration",
        "integrations_connectors",
        "membership_access",
        "developer_tools",
        "utilities_misc",
    ],
}

MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct"
MAX_RETRIES = 5
BASE_BACKOFF_SECONDS = 2.0
STREAM_ENABLED = os.environ.get("GROQ_STREAM", "1") != "0"

DATA_ROOT = Path("data")
README_ROOT = DATA_ROOT / "readmes"
OUTPUT_PATH = DATA_ROOT / "classifications_groq.json"
PROGRESS_PATH = DATA_ROOT / "classifications_progress.json"
MISSING_PATH = DATA_ROOT / "classifications_missing.json"
LOG_PATH = DATA_ROOT / "classify_with_groq.log"


def log_line(message: str):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{timestamp}] {message}"
    print(line, flush=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def repo_to_readme_path(platform: str, repo: str) -> Path:
    filename = f"{repo.replace('/', '_')}.md"
    platform_dir = README_ROOT / platform
    direct = platform_dir / filename
    if direct.exists():
        return direct
    matches = list(platform_dir.glob(f"*{filename}"))
    if matches:
        return matches[0]
    return direct


def load_top100_items():
    items = []
    for path in sorted(DATA_ROOT.glob("*/top100.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("top100", []):
            items.append(item)
    return items


def build_input_payload(item):
    platform = item.get("platform", "")
    repo = item.get("repo", "")
    readme_path = repo_to_readme_path(platform, repo)
    readme = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""
    github_stats = item.get("githubStats") or {}

    return {
        "platform": platform,
        "repo": repo,
        "name": item.get("name", ""),
        "description": item.get("description", ""),
        "tags": item.get("tags", []),
        "categories": item.get("categories", []),
        "downloads": item.get("downloads"),
        "stars": github_stats.get("stars"),
        "lastUpdated": github_stats.get("lastUpdated") or item.get("lastUpdated"),
        "readme": readme,
    }


def build_prompt(input_item):
    platform = input_item["platform"]
    specific_categories = PLATFORM_CATEGORIES.get(platform, [])

    prompt = {
        "role": "user",
        "content": (
            "You are a careful and conservative classifier.\n\n"
            "Your task is to classify open-source plugins using ONLY the provided input data "
            "(README content if present, otherwise description + tags + metadata).\n\n"
            "Do NOT use external knowledge.\n"
            "Do NOT infer features not stated in the input.\n"
            "When uncertain, choose the safest and most generic category.\n\n"
            "GENERIC CATEGORIES:\n"
            f"{', '.join(GENERIC_CATEGORIES)}\n\n"
            "PLATFORM-SPECIFIC CATEGORIES:\n"
            f"{', '.join(specific_categories)}\n\n"
            "TASK:\n"
            "- Assign 1-3 generic categories from the GENERIC list.\n"
            "- Assign 1-3 platform-specific categories from the platform list.\n"
            "- If README is empty, classify using only description and tags.\n\n"
            "RULES:\n"
            "- Use ONLY the predefined category lists.\n"
            "- Prefer fewer categories over many.\n"
            "- If classification is ambiguous, select utilities_misc.\n"
            "- Categories must be clearly supported by the input text.\n"
            "- Output MUST be valid JSON and nothing else.\n\n"
            "INPUT:\n"
            f"{json.dumps([input_item], ensure_ascii=False)}\n\n"
            "OUTPUT FORMAT:\n"
            "Return a JSON array with a single object:\n"
            "[\n"
            "  {\n"
            "    \"platform\": string,\n"
            "    \"repo\": string,\n"
            "    \"name\": string,\n"
            "    \"generic_categories\": [string],\n"
            "    \"specific_categories\": [string],\n"
            "    \"readme_missing\": boolean,\n"
            "    \"confidence\": number\n"
            "  }\n"
            "]\n"
        ),
    }
    return prompt


def parse_response(text):
    cleaned = text.strip()
    if "```" in cleaned:
        parts = re.split(r"```(?:json)?", cleaned, flags=re.IGNORECASE)
        if len(parts) >= 2:
            cleaned = parts[1]
    start = cleaned.find("[")
    if start == -1:
        raise ValueError("No JSON array found in response")
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(cleaned[start:])
    if not isinstance(obj, list):
        raise ValueError("Response JSON is not a list")
    return obj


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    api_key = os.environ.get("GROQ_API")


    client = Groq(api_key="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")

    all_items = load_top100_items()
    all_ids = [f"{it.get('platform')}:{it.get('repo')}" for it in all_items]

    output = load_json(OUTPUT_PATH, [])
    progress = load_json(PROGRESS_PATH, {"processed_ids": [], "failed_ids": [], "total": len(all_ids)})

    processed = set(progress.get("processed_ids", []))
    failed = set(progress.get("failed_ids", []))

    total = len(all_items)
    for index, item in enumerate(all_items, start=1):
        item_id = f"{item.get('platform')}:{item.get('repo')}"
        if item_id in processed:
            continue

        input_item = build_input_payload(item)
        prompt = build_prompt(input_item)

        response_text = ""
        try:
            log_line(f"start item={item_id} index={index}/{total}")
            attempt = 0
            while True:
                attempt += 1
                try:
                    completion = client.chat.completions.create(
                        model=MODEL_NAME,
                        messages=[prompt],
                        temperature=1,
                        max_completion_tokens=1024,
                        top_p=1,
                        stream=STREAM_ENABLED,
                        stop=None,
                    )

                    if STREAM_ENABLED:
                        for chunk in completion:
                            delta = chunk.choices[0].delta.content or ""
                            response_text += delta
                    else:
                        response_text = completion.choices[0].message.content or ""

                    parsed = parse_response(response_text)
                    break
                except Exception as exc:
                    message = str(exc)
                    log_line(f"error item={item_id} attempt={attempt} detail={message}")
                    is_rate_limit = "429" in message or "Too Many Requests" in message
                    is_stream_issue = "stream" in message.lower() or "connection" in message.lower()
                    is_parse_issue = isinstance(exc, (json.JSONDecodeError, ValueError))
                    should_retry = is_rate_limit or is_stream_issue or is_parse_issue
                    if should_retry and attempt <= MAX_RETRIES:
                        backoff = BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
                        log_line(
                            f"retry item={item_id} attempt={attempt}/{MAX_RETRIES} "
                            f"sleep={backoff:.1f}s"
                        )
                        time.sleep(backoff)
                        response_text = ""
                        continue
                    raise

            result = parsed[0]
            result["platform"] = input_item["platform"]
            result["repo"] = input_item["repo"]
            result["name"] = input_item["name"]

            output.append(result)
            processed.add(item_id)
            if item_id in failed:
                failed.remove(item_id)

            save_json(OUTPUT_PATH, output)
            progress = {
                "processed_ids": sorted(processed),
                "failed_ids": sorted(failed),
                "total": len(all_ids),
            }
            save_json(PROGRESS_PATH, progress)
            log_line(f"done item={item_id} index={index}/{total}")

        except Exception as exc:
            failed.add(item_id)
            progress = {
                "processed_ids": sorted(processed),
                "failed_ids": sorted(failed),
                "total": len(all_ids),
            }
            save_json(PROGRESS_PATH, progress)
            log_line(f"failed item={item_id} index={index}/{total} detail={exc}")

        missing = [pid for pid in all_ids if pid not in processed]
        save_json(MISSING_PATH, missing)

        time.sleep(0.2)


if __name__ == "__main__":
    main()
