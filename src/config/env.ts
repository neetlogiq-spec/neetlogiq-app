// Environment configuration for NeetLogIQ
export const env = {
  // API Configuration
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Firebase Configuration
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBoTOrLIfgMkfr3lMQQJd3f_ZWqfi-bFjk',
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'neetlogiq-15499.firebaseapp.com',
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'neetlogiq-15499',
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'neetlogiq-15499.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '100369453309',
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:100369453309:web:205c0f116b5d899580ee94',
  FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-V4V48LV46K',
  
  // Database Configuration (for future use)
  DATABASE_URL: process.env.DATABASE_URL || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  R2_ENDPOINT: process.env.R2_ENDPOINT || '',
  
  // Development
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
