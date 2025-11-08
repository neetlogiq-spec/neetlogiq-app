const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Output standalone for optimized deployment
  output: 'standalone',

  // Skip type checking and linting in production to reduce memory usage
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Turbopack configuration
  turbopack: {},

  // Development optimizations
  ...(isDev && {
    // Faster development builds
    onDemandEntries: {
      maxInactiveAge: 25 * 1000, // 25 seconds
      pagesBufferLength: 2, // Keep only 2 pages in memory
    },
  }),

  // Experimental optimizations
  experimental: {
    // Enable faster builds in development
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // Reduce memory usage during build
    serverMinification: false,
  },

  // Externalize native modules (not needed in browser/edge)
  serverExternalPackages: [
    'duckdb',
    'better-sqlite3',
    'sqlite3',
    'parquetjs',
    'xlsx',
    'natural',
  ],

  // Configure webpack to exclude native modules from bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize native modules on server
      config.externals.push({
        'duckdb': 'commonjs duckdb',
        'better-sqlite3': 'commonjs better-sqlite3',
        'sqlite3': 'commonjs sqlite3',
      });
    }
    // Reduce memory usage
    config.optimization = {
      ...config.optimization,
      minimize: false, // Disable minification during build to save memory
    };
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
