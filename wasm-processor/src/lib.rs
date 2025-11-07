// WebAssembly Processor for Edge-Native Architecture
// High-performance data processing with SIMD optimizations

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use rayon::prelude::*;

// Re-export modules
mod compression;
mod vector_search;
mod data_processor;
mod analytics;
mod memory_manager;

use compression::CompressionProcessor;
use vector_search::VectorSearchProcessor;
use data_processor::DataProcessor;
use analytics::AnalyticsProcessor;
use memory_manager::MemoryManager;

// Global state management
static COMPRESSION_PROCESSOR: Mutex<Option<CompressionProcessor>> = Mutex::new(None);
static VECTOR_SEARCH_PROCESSOR: Mutex<Option<VectorSearchProcessor>> = Mutex::new(None);
static DATA_PROCESSOR: Mutex<Option<DataProcessor>> = Mutex::new(None);
static ANALYTICS_PROCESSOR: Mutex<Option<AnalyticsProcessor>> = Mutex::new(None);
static MEMORY_MANAGER: Mutex<Option<MemoryManager>> = Mutex::new(None);

/// Initialize the WebAssembly processor
#[wasm_bindgen]
pub fn init() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    
    // Initialize memory manager
    let memory_manager = MemoryManager::new();
    *MEMORY_MANAGER.lock().unwrap() = Some(memory_manager);
    
    // Initialize compression processor
    let compression_processor = CompressionProcessor::new();
    *COMPRESSION_PROCESSOR.lock().unwrap() = Some(compression_processor);
    
    // Initialize vector search processor
    let vector_search_processor = VectorSearchProcessor::new();
    *VECTOR_SEARCH_PROCESSOR.lock().unwrap() = Some(vector_search_processor);
    
    // Initialize data processor
    let data_processor = DataProcessor::new();
    *DATA_PROCESSOR.lock().unwrap() = Some(data_processor);
    
    // Initialize analytics processor
    let analytics_processor = AnalyticsProcessor::new();
    *ANALYTICS_PROCESSOR.lock().unwrap() = Some(analytics_processor);
    
    Ok(())
}

/// Compress data using LZ4 algorithm
#[wasm_bindgen]
pub fn compress_lz4(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut processor = COMPRESSION_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Compression processor not initialized")?;
    
    processor.compress_lz4(data)
        .map_err(|e| JsValue::from_str(&format!("Compression error: {}", e)))
}

/// Decompress data using LZ4 algorithm
#[wasm_bindgen]
pub fn decompress_lz4(compressed_data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut processor = COMPRESSION_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Compression processor not initialized")?;
    
    processor.decompress_lz4(compressed_data)
        .map_err(|e| JsValue::from_str(&format!("Decompression error: {}", e)))
}

// ZSTD functions disabled for now due to native dependencies
// #[wasm_bindgen]
// pub fn compress_zstd(data: &[u8], level: i32) -> Result<Vec<u8>, JsValue> {
//     // Implementation would go here
// }

/// Process cutoff data with high performance
#[wasm_bindgen]
pub fn process_cutoff_data(json_data: &str) -> Result<String, JsValue> {
    let mut processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Data processor not initialized")?;
    
    processor.process_cutoff_data(json_data)
        .map_err(|e| JsValue::from_str(&format!("Processing error: {}", e)))
}

/// Search cutoffs with advanced filtering
#[wasm_bindgen]
pub fn search_cutoffs(filters_json: &str, limit: usize) -> Result<String, JsValue> {
    let mut processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Data processor not initialized")?;
    
    processor.search_cutoffs(filters_json, limit)
        .map_err(|e| JsValue::from_str(&format!("Search error: {}", e)))
}

/// Vector similarity search
#[wasm_bindgen]
pub fn search_by_vector(query_vector: &[f32], limit: usize) -> Result<String, JsValue> {
    let mut processor = VECTOR_SEARCH_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Vector search processor not initialized")?;
    
    processor.search_by_similarity(query_vector, limit)
        .map_err(|e| JsValue::from_str(&format!("Vector search error: {}", e)))
}

/// Generate query embedding
#[wasm_bindgen]
pub fn generate_embedding(text: &str) -> Result<Vec<f32>, JsValue> {
    let mut processor = VECTOR_SEARCH_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Vector search processor not initialized")?;
    
    processor.generate_embedding(text)
        .map_err(|e| JsValue::from_str(&format!("Embedding generation error: {}", e)))
}

/// Calculate analytics
#[wasm_bindgen]
pub fn calculate_analytics(data_json: &str) -> Result<String, JsValue> {
    let mut processor = ANALYTICS_PROCESSOR.lock().unwrap();
    let processor = processor.as_mut().ok_or("Analytics processor not initialized")?;
    
    processor.calculate_analytics(data_json)
        .map_err(|e| JsValue::from_str(&format!("Analytics error: {}", e)))
}

/// Get memory usage statistics
#[wasm_bindgen]
pub fn get_memory_usage() -> Result<String, JsValue> {
    let manager = MEMORY_MANAGER.lock().unwrap();
    let manager = manager.as_ref().ok_or("Memory manager not initialized")?;
    
    let stats = manager.get_usage_stats();
    serde_json::to_string(&stats)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Clear all data and free memory
#[wasm_bindgen]
pub fn clear_data() -> Result<(), JsValue> {
    // Clear all processors
    if let Ok(mut processor) = DATA_PROCESSOR.lock() {
        if let Some(p) = processor.as_mut() {
            p.clear_data();
        }
    }
    
    if let Ok(mut processor) = VECTOR_SEARCH_PROCESSOR.lock() {
        if let Some(p) = processor.as_mut() {
            p.clear_data();
        }
    }
    
    if let Ok(mut manager) = MEMORY_MANAGER.lock() {
        if let Some(m) = manager.as_mut() {
            m.clear_all();
        }
    }
    
    Ok(())
}

/// Get performance statistics
#[wasm_bindgen]
pub fn get_performance_stats() -> Result<String, JsValue> {
    let mut stats = serde_json::Map::new();
    
    // Get compression stats
    if let Ok(processor) = COMPRESSION_PROCESSOR.lock() {
        if let Some(p) = processor.as_ref() {
            stats.insert("compression".to_string(), serde_json::to_value(p.get_stats()).unwrap());
        }
    }
    
    // Get vector search stats
    if let Ok(processor) = VECTOR_SEARCH_PROCESSOR.lock() {
        if let Some(p) = processor.as_ref() {
            stats.insert("vector_search".to_string(), serde_json::to_value(p.get_stats()).unwrap());
        }
    }
    
    // Get data processing stats
    if let Ok(processor) = DATA_PROCESSOR.lock() {
        if let Some(p) = processor.as_ref() {
            stats.insert("data_processing".to_string(), serde_json::to_value(p.get_stats()).unwrap());
        }
    }
    
    serde_json::to_string(&stats)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
