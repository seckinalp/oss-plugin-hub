import { getAnalyticsData } from "@/utils/analytics";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import Link from "next/link";

export const metadata = {
  title: "Analytics - All Platforms (Top 900)",
  description: "Aggregate metrics across the top 100 plugins for each platform (900 total).",
};

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-2 inline-block">
            ← Back to plugins
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">All-Platforms Analytics</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Explore combined analytics across any platform combination (default: all 900 top plugins).
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <AnalyticsDashboard data={data} />
      </main>
    </div>
  );
}
