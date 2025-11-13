/**
 * Platform configuration for OSS Plugin Hub
 * This file centralizes all platform definitions and ensures consistency
 */

export const SUPPORTED_PLATFORMS = [
  'obsidian',
  'vscode', 
  'firefox',
  'homeassistant',
  'wordpress',
  'jetbrains',
  'sublime',
  'minecraft'
] as const;

export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

/**
 * Platform metadata for display and configuration
 */
export const PLATFORM_CONFIG = {
  obsidian: {
    label: 'Obsidian',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: '📝',
    description: 'Note-taking and knowledge management plugins'
  },
  vscode: {
    label: 'VS Code',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: '💻',
    description: 'Visual Studio Code extensions'
  },
  firefox: {
    label: 'Firefox',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: '🦊',
    description: 'Firefox browser add-ons'
  },
  homeassistant: {
    label: 'Home Assistant',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: '🏠',
    description: 'Home automation components'
  },
  wordpress: {
    label: 'WordPress',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    icon: '🌐',
    description: 'WordPress plugins and themes'
  },
  jetbrains: {
    label: 'JetBrains',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: '🚀',
    description: 'JetBrains IDE plugins'
  },
  sublime: {
    label: 'Sublime Text',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: '✨',
    description: 'Sublime Text packages'
  },
  minecraft: {
    label: 'Minecraft',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    icon: '🎮',
    description: 'Minecraft mods and plugins'
  }
} as const;

/**
 * Get platform configuration by platform key
 */
export function getPlatformConfig(platform: SupportedPlatform) {
  return PLATFORM_CONFIG[platform];
}

/**
 * Get all platform configurations
 */
export function getAllPlatformConfigs() {
  return Object.entries(PLATFORM_CONFIG).map(([key, config]) => ({
    key: key as SupportedPlatform,
    ...config
  }));
}

/**
 * Check if a platform is supported
 */
export function isSupportedPlatform(platform: string): platform is SupportedPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
}

/**
 * Get platform statistics from metadata
 */
export function getPlatformStats() {
  return {
    totalPlatforms: SUPPORTED_PLATFORMS.length,
    platforms: SUPPORTED_PLATFORMS,
    config: PLATFORM_CONFIG
  };
}
