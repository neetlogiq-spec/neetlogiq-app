const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Turbopack configuration
  turbopack: {},
  
  // Development optimizations
  ...(isDev && {
    // Faster development builds
    onDemandEntries: {
      maxInactiveAge: 25 * 1000, // 25 seconds
      pagesBufferLength: 2, // Keep only 2 pages in memory
    },
    // Skip type checking in development for faster builds
    typescript: {
      ignoreBuildErrors: true,
    },
    // Skip ESLint during builds in development
    eslint: {
      ignoreDuringBuilds: true,
    },
  }),

  // Turbopack configuration (commented out for Next.js 14 compatibility)
  // turbopack: {
  //   rules: {
  //     '*.svg': {
  //       loaders: ['@svgr/webpack'],
  //       as: '*.js',
  //     },
  //   },
  // },

  // Experimental optimizations
  experimental: {
    // Enable faster builds in development
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  // Server external packages - exclude native modules (commented out for Next.js 14 compatibility)
  // serverExternalPackages: ['duckdb'],
  
  // Configure webpack for native modules
  webpack: (config) => {
    // Handle native modules
    config.externals.push({
      'duckdb': 'commonjs duckdb',
    });
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
