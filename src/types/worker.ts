export interface Env {
  // D1 Database
  DB: any; // D1Database type not available in frontend
  
  // R2 Storage
  BUCKET: any; // R2Bucket type not available in frontend
  
  // KV Storage
  CACHE: any; // KVNamespace type not available in frontend
  
  // Vectorize
  VECTORIZE: any; // Vectorize type not available in frontend
  
  // AI Gateway
  AI_GATEWAY: any;
  
  // Environment variables
  NODE_ENV: string;
  NEXT_PUBLIC_API_URL: string;
}

export interface WorkerRequest extends Request {
  env: Env;
}
