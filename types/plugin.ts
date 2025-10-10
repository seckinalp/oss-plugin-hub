export interface ObsidianPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  branch?: string;
  authorUrl?: string;
  fundingUrl?: string;
}

export interface PluginData {
  plugins: ObsidianPlugin[];
  lastUpdated: string;
}

