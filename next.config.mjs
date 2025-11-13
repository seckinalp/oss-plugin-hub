/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use dynamic rendering instead of static export
  // With 100k+ plugins, generating all static pages is impractical
  // Comment out the following lines to enable static export if needed:
  // output: 'export',
  // trailingSlash: true,
  // skipTrailingSlashRedirect: true,
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
    // Enable image optimization for better performance
    unoptimized: false,
  },
  
  // Build optimizations
  experimental: {
    // Reduce bundle size
    optimizePackageImports: ['react-markdown', 'remark-gfm'],
  },
  
  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Optimize for production builds
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;

