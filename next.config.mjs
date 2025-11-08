const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Static export for Cloudflare Pages (no Node.js server)
  output: 'export',

  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },

  // Skip type checking to reduce memory usage
  typescript: {
    ignoreBuildErrors: true,
  },

  // Turbopack disabled for compatibility
  turbopack: undefined,

  // Development optimizations
  ...(isDev && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // Minimal experimental features to reduce memory
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  // Configure webpack for memory efficiency
  webpack: (config, { isServer }) => {
    // Externalize native modules and services that use them
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push(
        // Native modules
        'duckdb',
        'better-sqlite3',
        'sqlite3',
        'parquetjs',
        'xlsx',
        'natural',
        'lz4js',
        // Services that import native modules
        /^@\/services\/master-data-service/,
        /^@\/services\/id-based-data-service/,
        /^@\/services\/database/,
        /^@\/services\/cloudflare-optimized-storage/,
        /^@\/lib\/data\//,
        /^@\/lib\/database\//,
      );
    }

    // Aggressive memory optimization
    config.optimization = {
      ...config.optimization,
      minimize: false,
      splitChunks: false,
      runtimeChunk: false,
    };

    // Reduce parallelism to save memory
    config.parallelism = 1;

    return config;
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500',
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
