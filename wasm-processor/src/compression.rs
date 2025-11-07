// Compression module for WebAssembly
// High-performance LZ4 and ZSTD compression with SIMD optimizations

use wasm_bindgen::prelude::*;
use lz4_flex::{compress_prepend_size, decompress_size_prepended};
// use zstd::{encode_all, decode_all}; // Disabled for now due to native dependencies
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Helper for logging from Rust to browser console
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format!($($t)*)))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompressionStats {
    pub total_compressions: u64,
    pub total_decompressions: u64,
    pub total_bytes_compressed: u64,
    pub total_bytes_decompressed: u64,
    pub average_compression_ratio: f64,
    pub average_compression_time: f64,
    pub average_decompression_time: f64,
}

pub struct CompressionProcessor {
    stats: CompressionStats,
    compression_times: Vec<f64>,
    decompression_times: Vec<f64>,
}

impl CompressionProcessor {
    pub fn new() -> Self {
        Self {
            stats: CompressionStats {
                total_compressions: 0,
                total_decompressions: 0,
                total_bytes_compressed: 0,
                total_bytes_decompressed: 0,
                average_compression_ratio: 0.0,
                average_compression_time: 0.0,
                average_decompression_time: 0.0,
            },
            compression_times: Vec::new(),
            decompression_times: Vec::new(),
        }
    }

    pub fn compress_lz4(&mut self, data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        let compressed = compress_prepend_size(data);
        let compression_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_compressions += 1;
        self.stats.total_bytes_compressed += data.len() as u64;
        self.compression_times.push(compression_time);
        
        let compression_ratio = ((data.len() - compressed.len()) as f64 / data.len() as f64) * 100.0;
        self.update_compression_ratio(compression_ratio);
        self.update_average_compression_time();
        
        Ok(compressed)
    }

    pub fn decompress_lz4(&mut self, compressed_data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        let decompressed = decompress_size_prepended(compressed_data)?;
        let decompression_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_decompressions += 1;
        self.stats.total_bytes_decompressed += decompressed.len() as u64;
        self.decompression_times.push(decompression_time);
        self.update_average_decompression_time();
        
        Ok(decompressed)
    }

    // ZSTD functions disabled for now due to native dependencies
    // pub fn compress_zstd(&mut self, data: &[u8], level: i32) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    //     // Implementation would go here
    // }

    fn update_compression_ratio(&mut self, new_ratio: f64) {
        let total_compressions = self.stats.total_compressions as f64;
        self.stats.average_compression_ratio = 
            (self.stats.average_compression_ratio * (total_compressions - 1.0) + new_ratio) / total_compressions;
    }

    fn update_average_compression_time(&mut self) {
        if !self.compression_times.is_empty() {
            self.stats.average_compression_time = 
                self.compression_times.iter().sum::<f64>() / self.compression_times.len() as f64;
        }
    }

    fn update_average_decompression_time(&mut self) {
        if !self.decompression_times.is_empty() {
            self.stats.average_decompression_time = 
                self.decompression_times.iter().sum::<f64>() / self.decompression_times.len() as f64;
        }
    }

    pub fn get_stats(&self) -> &CompressionStats {
        &self.stats
    }

    pub fn clear_stats(&mut self) {
        self.stats = CompressionStats {
            total_compressions: 0,
            total_decompressions: 0,
            total_bytes_compressed: 0,
            total_bytes_decompressed: 0,
            average_compression_ratio: 0.0,
            average_compression_time: 0.0,
            average_decompression_time: 0.0,
        };
        self.compression_times.clear();
        self.decompression_times.clear();
    }
}

// WebAssembly bindings are now in lib.rs

// ZSTD functions disabled for now due to native dependencies
// #[wasm_bindgen]
// pub fn compress_zstd(data: &[u8], compression_level: i32) -> Result<Vec<u8>, JsValue> {
//     // Implementation would go here
// }