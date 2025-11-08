const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Standalone build for Cloudflare Pages
  output: 'standalone',

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
    // Don't process native modules at all
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'duckdb': 'commonjs duckdb',
        'better-sqlite3': 'commonjs better-sqlite3',
        'sqlite3': 'commonjs sqlite3',
      });
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
  
  // Image optimization
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
    formats: ['image/webp', 'image/avif'],
    // Faster image processing in development
    ...(isDev && {
      unoptimized: true,
    }),
  },
  
  // Compression (disable in development for faster builds)
  compress: !isDev,
  
  // Headers for security and performance (skip in development)
  ...(isDev ? {} : {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
