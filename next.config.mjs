const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Static export for Cloudflare Pages (no Node.js server)
  // Temporarily disabled for development to allow API routes
  output: isDev ? undefined : 'export',

  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },

  // Skip type checking to reduce memory usage
  typescript: {
    ignoreBuildErrors: true,
  },

  // Development optimizations
  ...(isDev && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // Minimal experimental features to reduce memory
  experimental: {
<<<<<<< Updated upstream
    optimizePackageImports: ['lucide-react', 'framer-motion'],
=======
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],

    // ✅ Server Actions for type-safe mutations
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: isDev ? ['localhost:3500', '127.0.0.1:3500', '192.168.31.3:3500', '*.lan', '*.local'] : ['neetlogiq.com', 'www.neetlogiq.com']
    },

    // ✅ Partial Prerendering (latest Next.js feature)
    // ppr: true,  // Enable when ready for production
>>>>>>> Stashed changes
  },

  // Configure webpack for memory efficiency and WASM support
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Ignore problematic pages with advanced features
    config.ignoreWarnings = [
      { module: /duckdb-wasm/ },
      { module: /papaparse/ },
    ];

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
        'papaparse',
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
