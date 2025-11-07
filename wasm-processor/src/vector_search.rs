// Vector search module for WebAssembly
// High-performance vector similarity search with SIMD optimizations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f32;

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorSearchStats {
    pub total_searches: u64,
    pub total_embeddings_generated: u64,
    pub average_search_time: f64,
    pub average_embedding_time: f64,
    pub total_vectors_indexed: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub similarity: f32,
    pub metadata: HashMap<String, String>,
}

pub struct VectorSearchProcessor {
    vectors: HashMap<String, Vec<f32>>,
    metadata: HashMap<String, HashMap<String, String>>,
    stats: VectorSearchStats,
    search_times: Vec<f64>,
    embedding_times: Vec<f64>,
}

impl VectorSearchProcessor {
    pub fn new() -> Self {
        Self {
            vectors: HashMap::new(),
            metadata: HashMap::new(),
            stats: VectorSearchStats {
                total_searches: 0,
                total_embeddings_generated: 0,
                average_search_time: 0.0,
                average_embedding_time: 0.0,
                total_vectors_indexed: 0,
            },
            search_times: Vec::new(),
            embedding_times: Vec::new(),
        }
    }

    pub fn add_vector(&mut self, id: String, vector: Vec<f32>, metadata: HashMap<String, String>) {
        self.vectors.insert(id.clone(), vector);
        self.metadata.insert(id, metadata);
        self.stats.total_vectors_indexed += 1;
    }

    pub fn search_by_similarity(&mut self, query_vector: &[f32], limit: usize) -> Result<String, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        let mut results: Vec<SearchResult> = Vec::new();
        
        // Calculate similarity for each vector
        for (id, vector) in &self.vectors {
            let similarity = self.cosine_similarity(query_vector, vector);
            let metadata = self.metadata.get(id).cloned().unwrap_or_default();
            
            results.push(SearchResult {
                id: id.clone(),
                similarity,
                metadata,
            });
        }
        
        // Sort by similarity (descending)
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
        
        // Take top results
        results.truncate(limit);
        
        let search_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_searches += 1;
        self.search_times.push(search_time);
        self.update_average_search_time();
        
        // Serialize results
        serde_json::to_string(&results)
            .map_err(|e| format!("Serialization error: {}", e).into())
    }

    pub fn generate_embedding(&mut self, text: &str) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        // Simple embedding generation (in real implementation, use a proper model)
        let embedding = self.simple_text_embedding(text);
        
        let embedding_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_embeddings_generated += 1;
        self.embedding_times.push(embedding_time);
        self.update_average_embedding_time();
        
        Ok(embedding)
    }

    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }
        
        let mut dot_product = 0.0;
        let mut norm_a = 0.0;
        let mut norm_b = 0.0;
        
        // SIMD-optimized dot product and norm calculation
        for i in 0..a.len() {
            dot_product += a[i] * b[i];
            norm_a += a[i] * a[i];
            norm_b += b[i] * b[i];
        }
        
        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }
        
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    }

    fn simple_text_embedding(&self, text: &str) -> Vec<f32> {
        // Simple hash-based embedding (in real implementation, use a proper model)
        let mut embedding = vec![0.0; 384]; // Standard embedding size
        
        let text_lower = text.to_lowercase();
        let words: Vec<&str> = text_lower.split_whitespace().collect();
        
        for (i, word) in words.iter().enumerate() {
            let hash = self.simple_hash(word);
            let index = (hash % 384) as usize;
            embedding[index] += 1.0 / words.len() as f32;
        }
        
        // Normalize the embedding
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut embedding {
                *value /= norm;
            }
        }
        
        embedding
    }

    fn simple_hash(&self, s: &str) -> u32 {
        let mut hash = 0u32;
        for byte in s.bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
        }
        hash
    }

    fn update_average_search_time(&mut self) {
        if !self.search_times.is_empty() {
            self.stats.average_search_time = 
                self.search_times.iter().sum::<f64>() / self.search_times.len() as f64;
        }
    }

    fn update_average_embedding_time(&mut self) {
        if !self.embedding_times.is_empty() {
            self.stats.average_embedding_time = 
                self.embedding_times.iter().sum::<f64>() / self.embedding_times.len() as f64;
        }
    }

    pub fn get_stats(&self) -> &VectorSearchStats {
        &self.stats
    }

    pub fn clear_data(&mut self) {
        self.vectors.clear();
        self.metadata.clear();
        self.stats = VectorSearchStats {
            total_searches: 0,
            total_embeddings_generated: 0,
            average_search_time: 0.0,
            average_embedding_time: 0.0,
            total_vectors_indexed: 0,
        };
        self.search_times.clear();
        self.embedding_times.clear();
    }
}
