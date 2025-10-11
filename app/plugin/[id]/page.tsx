import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import { BasePlugin } from '@/types/plugin';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/types/plugin';
import { parseRepo, fetchRepoStats, fetchReadme, getPluginHealth, formatNumber, formatRelativeTime } from '@/utils/github';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Generate static paths for all plugins
export async function generateStaticParams() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'plugins.json');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    return data.plugins.map((plugin: BasePlugin) => ({
      id: plugin.id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

async function getPlugin(id: string): Promise<BasePlugin | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'plugins.json');
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    const plugin = data.plugins.find((p: BasePlugin) => p.id === id);
    
    if (!plugin) {
      return null;
    }

    // Fetch GitHub stats if not already present
    if (!plugin.github && plugin.repo) {
      const parsed = parseRepo(plugin.repo);
      if (parsed) {
        const stats = await fetchRepoStats(parsed.owner, parsed.repo);
        if (stats) {
          plugin.github = stats;
        }
      }
    }

    return plugin;
  } catch (error) {
    console.error('Error loading plugin:', error);
    return null;
  }
}

export default async function PluginPage({ params }: { params: { id: string } }) {
  const plugin = await getPlugin(params.id);

  if (!plugin) {
    notFound();
  }

  const platformLabel = PLATFORM_LABELS[plugin.platform];
  const platformColor = PLATFORM_COLORS[plugin.platform];

  // Fetch README
  let readme: string | null = null;
  if (plugin.repo) {
    const parsed = parseRepo(plugin.repo);
    if (parsed) {
      readme = await fetchReadme(parsed.owner, parsed.repo, plugin.branch || plugin.github?.defaultBranch);
    }
  }

  // Get health status
  const health = plugin.github ? getPluginHealth(plugin.github.lastUpdated) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm mb-2 inline-block">
            ← Back to all plugins
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {plugin.name}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {plugin.description}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            {plugin.github && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                  Repository Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatNumber(plugin.github.stars)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">⭐ Stars</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatNumber(plugin.github.forks)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">🍴 Forks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {plugin.github.openIssues}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">🐛 Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatNumber(plugin.github.watchers)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">👀 Watchers</div>
                  </div>
                </div>
              </div>
            )}

            {/* README */}
            {readme && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                  README
                </h2>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {readme}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {!readme && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  README not available. Visit the repository for more information.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Plugin Info */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Information
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-slate-600 dark:text-slate-400">Author</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-white">
                    {plugin.author}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600 dark:text-slate-400">Platform</dt>
                  <dd>
                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${platformColor}`}>
                      {platformLabel}
                    </span>
                  </dd>
                </div>
                {plugin.github?.license && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">License</dt>
                    <dd className="text-sm font-medium text-slate-900 dark:text-white">
                      {plugin.github.license}
                    </dd>
                  </div>
                )}
                {plugin.github?.language && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">Language</dt>
                    <dd className="text-sm font-medium text-slate-900 dark:text-white">
                      {plugin.github.language}
                    </dd>
                  </div>
                )}
                {plugin.github && (
                  <>
                    <div>
                      <dt className="text-sm text-slate-600 dark:text-slate-400">Last Updated</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-white">
                        {formatRelativeTime(plugin.github.lastUpdated)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600 dark:text-slate-400">Created</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-white">
                        {new Date(plugin.github.createdAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </>
                )}
                {health && (
                  <div>
                    <dt className="text-sm text-slate-600 dark:text-slate-400">Status</dt>
                    <dd>
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${health.color} ${health.textColor}`}>
                        {health.label}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Links */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Links
              </h3>
              <div className="space-y-2">
                <a
                  href={`https://github.com/${plugin.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
                {plugin.github?.homepage && (
                  <a
                    href={plugin.github.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Homepage
                  </a>
                )}
                {plugin.fundingUrl && (
                  <a
                    href={plugin.fundingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Support Author
                  </a>
                )}
              </div>
            </div>

            {/* Topics */}
            {plugin.github?.topics && plugin.github.topics.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {plugin.github.topics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

