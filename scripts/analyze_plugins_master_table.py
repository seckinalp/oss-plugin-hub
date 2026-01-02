import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd

try:
    from scipy import stats
except Exception:  # pragma: no cover - optional dependency
    stats = None

try:
    import matplotlib.pyplot as plt
except Exception as exc:  # pragma: no cover
    raise SystemExit(f"matplotlib is required: {exc}")

try:
    import seaborn as sns
except Exception:  # pragma: no cover
    sns = None


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
CSV_PATH = os.path.join(DATA_DIR, "paper", "plugins_master_table.csv")
OUTPUT_DIR = os.path.join(DATA_DIR, "paper", "analysis")
FIG_DIR = os.path.join(OUTPUT_DIR, "figures")

JSON_COLUMNS = [
    "tags",
    "categories",
    "sources_json",
    "pr_friction_samples",
    "github_topics",
    "scorecard_check_scores_json",
    "scorecard_checks_json",
    "sbom_analysis_dependencies_json",
    "vulnerability_summary_json",
    "classification_generic",
    "classification_specific",
    "classification_tags",
    "repo_dup_json",
    "dependency_summary_json",
    "platform_metadata_json",
]

NUMERIC_COLUMNS = [
    "users",
    "downloads",
    "rating",
    "rating_count",
    "stars",
    "github_stars",
    "github_forks",
    "github_open_issues",
    "github_watchers",
    "github_size",
    "scorecard_score",
    "openssf_score",
    "sbom_analysis_total_dependencies",
    "sbom_analysis_direct_dependencies_estimate",
    "sbom_analysis_transitive_dependencies_estimate",
    "pr_friction_median_days",
]

DATE_COLUMNS = [
    "published_date",
    "release_date",
    "last_updated",
    "github_created_at",
    "github_last_updated",
    "github_data_fetched_at",
    "scorecard_date",
    "openssf_score_date",
    "sbom_fetched_at",
]


def safe_json_load(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed == "" or trimmed.lower() in {"null", "none"}:
            return None
        try:
            return json.loads(trimmed)
        except json.JSONDecodeError:
            return None
    return None


def parse_json_columns(df):
    for col in JSON_COLUMNS:
        if col in df.columns:
            df[col] = df[col].apply(safe_json_load)
    return df


def to_numeric(df):
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def to_datetime(df):
    for col in DATE_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def build_flags(df):
    df["scorecard_present"] = df["scorecard_score"].notna()
    df["sbom_present"] = df["sbom_status"].notna()
    df["osv_present"] = df["vulnerability_summary_json"].notna()
    return df


def normalize_metrics(df):
    df["stars_value"] = df["github_stars"].combine_first(df["stars"])
    df["downloads_value"] = df["downloads"]
    df["log_stars"] = np.log1p(df["stars_value"].fillna(0))
    df["log_downloads"] = np.log1p(df["downloads_value"].fillna(0))
    df["issue_density"] = df["github_open_issues"] / df["stars_value"]
    df.loc[df["stars_value"] <= 0, "issue_density"] = np.nan
    return df


def explode_categories(df, column):
    series = df[column].apply(lambda x: x if isinstance(x, list) else [])
    exploded = df.copy()
    exploded[column] = series
    return exploded.explode(column).dropna(subset=[column])


def cohens_d(a, b):
    if len(a) < 2 or len(b) < 2:
        return np.nan
    a_var = np.var(a, ddof=1)
    b_var = np.var(b, ddof=1)
    pooled = ((len(a) - 1) * a_var + (len(b) - 1) * b_var) / (len(a) + len(b) - 2)
    if pooled <= 0:
        return np.nan
    return (np.mean(a) - np.mean(b)) / np.sqrt(pooled)


def mann_whitney_p(a, b):
    if stats is None or len(a) < 1 or len(b) < 1:
        return np.nan
    try:
        return stats.mannwhitneyu(a, b, alternative="two-sided").pvalue
    except Exception:
        return np.nan


def ols_with_platform(df, category_mask, y_col):
    if stats is None:
        return np.nan, np.nan
    subset = df[[y_col, "platform"]].copy()
    subset = subset.join(category_mask.rename("is_category"))
    subset = subset.dropna(subset=[y_col])
    if subset.shape[0] < 10:
        return np.nan, np.nan

    y = subset[y_col].to_numpy()
    platforms = pd.get_dummies(subset["platform"], drop_first=True)
    X = pd.concat([pd.Series(1, index=subset.index, name="intercept"), subset["is_category"], platforms], axis=1)
    X = X.to_numpy(dtype=float)

    try:
        beta, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError:
        return np.nan, np.nan

    residuals = y - X @ beta
    dof = max(X.shape[0] - X.shape[1], 1)
    sigma2 = (residuals ** 2).sum() / dof
    try:
        cov = sigma2 * np.linalg.inv(X.T @ X)
    except np.linalg.LinAlgError:
        return np.nan, np.nan

    se = np.sqrt(np.diag(cov))
    if len(se) < 2 or se[1] == 0:
        return beta[1], np.nan
    t_stat = beta[1] / se[1]
    p_val = stats.t.sf(np.abs(t_stat), dof) * 2
    return beta[1], p_val


def compute_category_effects(df, category_col, category_type, metrics):
    results = []
    categories = sorted({c for c in df[category_col] if isinstance(c, str)})
    for category in categories:
        mask = df[category_col] == category
        group = df[mask]
        other = df[~mask]
        if group.empty:
            continue

        platform_counts = group["platform"].value_counts(normalize=True)
        platform_top = platform_counts.index[0] if not platform_counts.empty else None
        platform_share = float(platform_counts.iloc[0]) if not platform_counts.empty else 0.0

        for metric_name, metric_col, metric_log_col in metrics:
            vals_a = group[metric_col].dropna()
            vals_b = other[metric_col].dropna()
            if len(vals_a) < 2 or len(vals_b) < 2:
                continue

            mean_diff = vals_a.mean() - vals_b.mean()
            median_diff = vals_a.median() - vals_b.median()
            d_value = cohens_d(vals_a, vals_b)
            mw_p = mann_whitney_p(vals_a, vals_b)

            adj_beta = np.nan
            adj_p = np.nan
            if metric_log_col:
                adj_beta, adj_p = ols_with_platform(
                    df,
                    df[category_col] == category,
                    metric_log_col,
                )

            results.append({
                "category_type": category_type,
                "category": category,
                "metric": metric_name,
                "n_category": int(len(vals_a)),
                "n_other": int(len(vals_b)),
                "mean_diff": float(mean_diff),
                "median_diff": float(median_diff),
                "cohens_d": float(d_value) if not math.isnan(d_value) else np.nan,
                "mann_whitney_p": float(mw_p) if not math.isnan(mw_p) else np.nan,
                "adj_beta": float(adj_beta) if not math.isnan(adj_beta) else np.nan,
                "adj_p": float(adj_p) if not math.isnan(adj_p) else np.nan,
                "platform_top": platform_top,
                "platform_share": platform_share,
                "low_sample": len(vals_a) < 10,
            })
    return pd.DataFrame(results)


def correlation_table(df, columns):
    rows = []
    for i, col_a in enumerate(columns):
        for col_b in columns[i + 1:]:
            a = df[col_a].dropna()
            b = df[col_b].dropna()
            joined = df[[col_a, col_b]].dropna()
            if joined.shape[0] < 3:
                continue
            pearson_r = np.nan
            pearson_p = np.nan
            spearman_r = np.nan
            spearman_p = np.nan
            if stats is not None:
                pearson_r, pearson_p = stats.pearsonr(joined[col_a], joined[col_b])
                spearman_r, spearman_p = stats.spearmanr(joined[col_a], joined[col_b])
            rows.append({
                "metric_a": col_a,
                "metric_b": col_b,
                "n": joined.shape[0],
                "pearson_r": pearson_r,
                "pearson_p": pearson_p,
                "spearman_r": spearman_r,
                "spearman_p": spearman_p,
            })
    return pd.DataFrame(rows)


def outlier_table(df, metric, top_n=10):
    series = df[metric].dropna()
    if series.empty:
        return pd.DataFrame()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr
    outliers = df[df[metric] > threshold].copy()
    outliers = outliers.sort_values(metric, ascending=False).head(top_n)
    return outliers[["plugin_name", "platform", metric, "repo"]]


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(FIG_DIR, exist_ok=True)


def write_markdown_report(context):
    report_path = os.path.join(OUTPUT_DIR, "insights.md")

    def df_to_markdown(df, max_rows=None):
        if df is None or df.empty:
            return "_No data_"
        if max_rows is not None:
            df = df.head(max_rows)
        data = df.fillna("").astype(str)
        cols = list(data.columns)
        rows = data.values.tolist()
        widths = [len(col) for col in cols]
        for row in rows:
            for idx, cell in enumerate(row):
                widths[idx] = max(widths[idx], len(str(cell)))
        header = "| " + " | ".join(col.ljust(widths[idx]) for idx, col in enumerate(cols)) + " |"
        sep = "| " + " | ".join("-" * widths[idx] for idx in range(len(widths))) + " |"
        lines = [header, sep]
        for row in rows:
            line = "| " + " | ".join(str(row[idx]).ljust(widths[idx]) for idx in range(len(widths))) + " |"
            lines.append(line)
        return "\n".join(lines)

    with open(report_path, "w", encoding="utf-8") as handle:
        handle.write(f"# Plugin Analysis Insights\n\n")
        handle.write(f"Generated at: {datetime.now(timezone.utc).isoformat()}Z\n\n")

        handle.write("## Overview\n")
        handle.write(f"- Total rows: {context['row_count']}\n")
        handle.write(f"- Platforms: {', '.join(context['platforms'])}\n\n")

        handle.write("## Missingness (Top 15)\n")
        handle.write(df_to_markdown(context["missingness_table"]))
        handle.write("\n\n")

        handle.write("## Platform Summary\n")
        handle.write(df_to_markdown(context["platform_summary"]))
        handle.write("\n\n")

        handle.write("## Coverage Rates\n")
        for key, value in context["coverage"].items():
            handle.write(f"- {key}: {value:.3f}\n")
        handle.write("\n")

        handle.write("## Top Findings (Effect Size + Significance)\n")
        if context["top_findings"].empty:
            handle.write("No strong effects after filtering.\n\n")
        else:
            handle.write(df_to_markdown(context["top_findings"]))
            handle.write("\n\n")

        handle.write("## Correlations\n")
        handle.write(df_to_markdown(context["correlations"]))
        handle.write("\n\n")

        handle.write("## Outliers\n")
        for metric, table in context["outliers"].items():
            handle.write(f"### {metric}\n")
            if table.empty:
                handle.write("No outliers found.\n\n")
            else:
                handle.write(df_to_markdown(table))
                handle.write("\n\n")

    return report_path


def main():
    ensure_dirs()
    df = pd.read_csv(CSV_PATH, na_values=["", "null", "None"])
    df = parse_json_columns(df)
    df = to_numeric(df)
    df = to_datetime(df)
    df = build_flags(df)
    df = normalize_metrics(df)

    row_count = df.shape[0]
    platforms = sorted(df["platform"].dropna().unique())

    missingness = (
        df.isna().mean()
        .reset_index()
        .rename(columns={"index": "column", 0: "missing_rate"})
        .sort_values("missing_rate", ascending=False)
        .head(15)
    )

    platform_summary = (
        df.groupby("platform")
        .agg(
            plugins=("top100_id", "count"),
            total_downloads=("downloads_value", "sum"),
            avg_downloads=("downloads_value", "mean"),
            median_downloads=("downloads_value", "median"),
            total_stars=("stars_value", "sum"),
            avg_stars=("stars_value", "mean"),
            median_stars=("stars_value", "median"),
            avg_rating=("rating", "mean"),
            avg_scorecard=("scorecard_score", "mean"),
        )
        .reset_index()
    )

    coverage = {
        "scorecard": df["scorecard_present"].mean(),
        "sbom": df["sbom_present"].mean(),
        "osv": df["osv_present"].mean(),
    }

    generic_long = explode_categories(df, "classification_generic")
    specific_long = explode_categories(df, "classification_specific")

    metrics = [
        ("stars", "stars_value", "log_stars"),
        ("downloads", "downloads_value", "log_downloads"),
        ("rating", "rating", None),
    ]

    generic_effects = compute_category_effects(generic_long, "classification_generic", "generic", metrics)
    specific_effects = compute_category_effects(specific_long, "classification_specific", "specific", metrics)

    generic_effects.to_csv(os.path.join(OUTPUT_DIR, "category_effects_generic.csv"), index=False)
    specific_effects.to_csv(os.path.join(OUTPUT_DIR, "category_effects_specific.csv"), index=False)

    correlations = correlation_table(
        df,
        ["stars_value", "downloads_value", "github_open_issues", "scorecard_score"],
    )
    correlations.to_csv(os.path.join(OUTPUT_DIR, "correlation_summary.csv"), index=False)

    outliers = {
        "stars_value": outlier_table(df, "stars_value"),
        "downloads_value": outlier_table(df, "downloads_value"),
        "github_open_issues": outlier_table(df, "github_open_issues"),
    }
    outliers_path = os.path.join(OUTPUT_DIR, "outliers.csv")
    pd.concat(
        [table.assign(metric=metric) for metric, table in outliers.items() if not table.empty],
        ignore_index=True,
    ).to_csv(outliers_path, index=False)

    platform_summary.to_csv(os.path.join(OUTPUT_DIR, "platform_summary.csv"), index=False)
    missingness.to_csv(os.path.join(OUTPUT_DIR, "missingness_summary.csv"), index=False)

    findings = pd.concat([generic_effects, specific_effects], ignore_index=True)
    findings = findings[
        (findings["low_sample"] == False)
        & (findings["platform_share"] < 0.7)
        & (findings["mann_whitney_p"] < 0.05)
    ]
    findings = findings.sort_values("cohens_d", key=lambda s: s.abs(), ascending=False).head(15)

    # Figures
    if sns:
        plt.figure(figsize=(10, 6))
        sns.scatterplot(
            data=generic_effects[generic_effects["metric"] == "stars"],
            x="cohens_d",
            y=-np.log10(generic_effects["mann_whitney_p"]),
            hue="platform_share",
            legend=False,
        )
        plt.title("Generic Category Effects (Stars)")
        plt.xlabel("Cohen's d")
        plt.ylabel("-log10(p)")
        plt.tight_layout()
        plt.savefig(os.path.join(FIG_DIR, "category_effects_generic.png"))
        plt.close()

        top_categories = (
            generic_long["classification_generic"]
            .value_counts()
            .head(6)
            .index
        )
        plt.figure(figsize=(10, 6))
        sns.boxplot(
            data=generic_long[generic_long["classification_generic"].isin(top_categories)],
            x="classification_generic",
            y="log_stars",
        )
        plt.xticks(rotation=30, ha="right")
        plt.title("Log Stars by Generic Category")
        plt.tight_layout()
        plt.savefig(os.path.join(FIG_DIR, "stars_by_category_boxplot.png"))
        plt.close()

        plt.figure(figsize=(8, 6))
        sns.scatterplot(data=df, x="log_downloads", y="log_stars", hue="platform", alpha=0.6)
        plt.title("Log Downloads vs Log Stars")
        plt.tight_layout()
        plt.savefig(os.path.join(FIG_DIR, "stars_downloads_scatter.png"))
        plt.close()

        plt.figure(figsize=(8, 6))
        sns.histplot(df["scorecard_score"].dropna(), bins=20)
        plt.title("Scorecard Score Distribution")
        plt.tight_layout()
        plt.savefig(os.path.join(FIG_DIR, "scorecard_hist.png"))
        plt.close()

    context = {
        "row_count": row_count,
        "platforms": platforms,
        "missingness_table": missingness,
        "platform_summary": platform_summary,
        "coverage": coverage,
        "top_findings": findings,
        "correlations": correlations,
        "outliers": outliers,
    }

    report_path = write_markdown_report(context)

    print("Analysis complete.")
    print(f"Report: {report_path}")
    print(f"CSVs: {OUTPUT_DIR}")
    print(f"Figures: {FIG_DIR}")


if __name__ == "__main__":
    main()
