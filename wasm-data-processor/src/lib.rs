//! WebAssembly Data Processor for NeetLogIQ
//! Handles dynamic cutoff types and high-performance data processing

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use rayon::prelude::*;

// Re-export modules
mod dynamic_types;
mod data_processor;
mod vector_search;
mod compression;
mod memory_manager;

use dynamic_types::*;
use data_processor::DataProcessor;
use vector_search::VectorSearch;
use compression::CompressionManager;
use memory_manager::MemoryManager;

// Global state management
static DATA_PROCESSOR: Mutex<Option<DataProcessor>> = Mutex::new(None);
static VECTOR_SEARCH: Mutex<Option<VectorSearch>> = Mutex::new(None);
static COMPRESSION_MANAGER: Mutex<Option<CompressionManager>> = Mutex::new(None);
static MEMORY_MANAGER: Mutex<Option<MemoryManager>> = Mutex::new(None);

/// Initialize the WebAssembly module
#[wasm_bindgen]
pub fn init() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    
    // Initialize memory manager
    let memory_manager = MemoryManager::new();
    *MEMORY_MANAGER.lock().unwrap() = Some(memory_manager);
    
    // Initialize data processor
    let data_processor = DataProcessor::new();
    *DATA_PROCESSOR.lock().unwrap() = Some(data_processor);
    
    // Initialize vector search
    let vector_search = VectorSearch::new();
    *VECTOR_SEARCH.lock().unwrap() = Some(vector_search);
    
    // Initialize compression manager
    let compression_manager = CompressionManager::new();
    *COMPRESSION_MANAGER.lock().unwrap() = Some(compression_manager);
    
    Ok(())
}

/// Process cutoff data with dynamic type handling
#[wasm_bindgen]
pub fn process_cutoff_data(
    json_data: &str,
    cutoff_type: &str,
    options: &str
) -> Result<String, JsValue> {
    let processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_ref().ok_or("Data processor not initialized")?;
    
    let cutoff_type_enum = CutoffType::from_str(cutoff_type)
        .map_err(|e| JsValue::from_str(&format!("Invalid cutoff type: {}", e)))?;
    
    let options: ProcessingOptions = serde_json::from_str(options)
        .map_err(|e| JsValue::from_str(&format!("Invalid options: {}", e)))?;
    
    let result = processor.process_cutoff_data(json_data, cutoff_type_enum, &options)
        .map_err(|e| JsValue::from_str(&format!("Processing error: {}", e)))?;
    
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Search cutoffs with advanced filtering
#[wasm_bindgen]
pub fn search_cutoffs(
    filters_json: &str,
    limit: usize
) -> Result<String, JsValue> {
    let processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_ref().ok_or("Data processor not initialized")?;
    
    let filters: CutoffFilters = serde_json::from_str(filters_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid filters: {}", e)))?;
    
    let results = processor.search_cutoffs(&filters, limit)
        .map_err(|e| JsValue::from_str(&format!("Search error: {}", e)))?;
    
    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Vector similarity search
#[wasm_bindgen]
pub fn search_cutoffs_by_vector(
    query_vector: &[f32],
    limit: usize
) -> Result<String, JsValue> {
    let vector_search = VECTOR_SEARCH.lock().unwrap();
    let vector_search = vector_search.as_ref().ok_or("Vector search not initialized")?;
    
    let results = vector_search.search_by_similarity(query_vector, limit)
        .map_err(|e| JsValue::from_str(&format!("Vector search error: {}", e)))?;
    
    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Generate query embedding
#[wasm_bindgen]
pub fn generate_query_embedding(query: &str) -> Result<Vec<f32>, JsValue> {
    let vector_search = VECTOR_SEARCH.lock().unwrap();
    let vector_search = vector_search.as_ref().ok_or("Vector search not initialized")?;
    
    vector_search.generate_embedding(query)
        .map_err(|e| JsValue::from_str(&format!("Embedding generation error: {}", e)))
}

/// Compress data
#[wasm_bindgen]
pub fn compress_data(data: &[u8], algorithm: &str) -> Result<Vec<u8>, JsValue> {
    let compression_manager = COMPRESSION_MANAGER.lock().unwrap();
    let compression_manager = compression_manager.as_ref().ok_or("Compression manager not initialized")?;
    
    let algorithm_enum = CompressionAlgorithm::from_str(algorithm)
        .map_err(|e| JsValue::from_str(&format!("Invalid compression algorithm: {}", e)))?;
    
    compression_manager.compress(data, algorithm_enum)
        .map_err(|e| JsValue::from_str(&format!("Compression error: {}", e)))
}

/// Decompress data
#[wasm_bindgen]
pub fn decompress_data(data: &[u8], algorithm: &str) -> Result<Vec<u8>, JsValue> {
    let compression_manager = COMPRESSION_MANAGER.lock().unwrap();
    let compression_manager = compression_manager.as_ref().ok_or("Compression manager not initialized")?;
    
    let algorithm_enum = CompressionAlgorithm::from_str(algorithm)
        .map_err(|e| JsValue::from_str(&format!("Invalid compression algorithm: {}", e)))?;
    
    compression_manager.decompress(data, algorithm_enum)
        .map_err(|e| JsValue::from_str(&format!("Decompression error: {}", e)))
}

/// Get memory usage statistics
#[wasm_bindgen]
pub fn get_memory_usage() -> Result<String, JsValue> {
    let memory_manager = MEMORY_MANAGER.lock().unwrap();
    let memory_manager = memory_manager.as_ref().ok_or("Memory manager not initialized")?;
    
    let stats = memory_manager.get_usage_stats();
    serde_json::to_string(&stats)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Clear all data and free memory
#[wasm_bindgen]
pub fn clear_data() -> Result<(), JsValue> {
    // Clear data processor
    if let Ok(mut processor) = DATA_PROCESSOR.lock() {
        if let Some(p) = processor.as_mut() {
            p.clear_data();
        }
    }
    
    // Clear vector search
    if let Ok(mut vector_search) = VECTOR_SEARCH.lock() {
        if let Some(vs) = vector_search.as_mut() {
            vs.clear_data();
        }
    }
    
    // Clear memory manager
    if let Ok(mut memory_manager) = MEMORY_MANAGER.lock() {
        if let Some(mm) = memory_manager.as_mut() {
            mm.clear_all();
        }
    }
    
    Ok(())
}

/// Get statistics about processed data
#[wasm_bindgen]
pub fn get_statistics() -> Result<String, JsValue> {
    let processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_ref().ok_or("Data processor not initialized")?;
    
    let stats = processor.get_statistics();
    serde_json::to_string(&stats)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Get cutoff by ID
#[wasm_bindgen]
pub fn get_cutoff_by_id(id: &str) -> Result<String, JsValue> {
    let processor = DATA_PROCESSOR.lock().unwrap();
    let processor = processor.as_ref().ok_or("Data processor not initialized")?;
    
    let cutoff = processor.get_cutoff_by_id(id)
        .map_err(|e| JsValue::from_str(&format!("Cutoff not found: {}", e)))?;
    
    serde_json::to_string(&cutoff)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
