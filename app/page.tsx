import PluginGrid from '@/components/PluginGrid';
import { PluginData } from '@/types/plugin';
import fs from 'fs';
import path from 'path';

async function getPluginData(): Promise<PluginData | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'plugins.json');
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    return {
      plugins: data.plugins || [],
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error loading plugin data:', error);
    return null;
  }
}

export default async function Home() {
  const pluginData = await getPluginData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            🔌 Plugin Discovery Hub
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Discover and explore open-source plugins for Obsidian
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {pluginData && pluginData.plugins.length > 0 ? (
          <PluginGrid
            plugins={pluginData.plugins}
            lastUpdated={pluginData.lastUpdated}
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 mb-4">
              <svg
                className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              No Plugin Data Available
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Run the data fetching script to download the latest plugin information from the Obsidian repository.
            </p>
            <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-4 text-left max-w-md mx-auto">
              <code className="text-sm text-slate-800 dark:text-slate-200">
                npm run fetch-plugins
              </code>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
            Built with ❤️ for the Obsidian community
          </p>
        </div>
      </footer>
    </div>
  );
}
