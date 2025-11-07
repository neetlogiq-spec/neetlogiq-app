// Data processor module for WebAssembly
// High-performance data processing with SIMD optimizations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rayon::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CutoffRecord {
    pub id: String,
    pub college_id: String,
    pub college_name: String,
    pub course_id: String,
    pub course_name: String,
    pub year: u32,
    pub round: u32,
    pub opening_rank: u32,
    pub closing_rank: u32,
    pub category: String,
    pub state: String,
    pub counselling_body: String,
    pub level: String,
    pub stream: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CutoffFilters {
    pub year: Option<u32>,
    pub round: Option<u32>,
    pub state: Option<String>,
    pub course: Option<String>,
    pub college: Option<String>,
    pub min_rank: Option<u32>,
    pub max_rank: Option<u32>,
    pub category: Option<String>,
    pub counselling_body: Option<String>,
    pub level: Option<String>,
    pub stream: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataProcessorStats {
    pub total_records_processed: u64,
    pub total_searches_performed: u64,
    pub average_processing_time: f64,
    pub average_search_time: f64,
    pub total_records_indexed: u64,
}

pub struct DataProcessor {
    records: Vec<CutoffRecord>,
    stats: DataProcessorStats,
    processing_times: Vec<f64>,
    search_times: Vec<f64>,
}

impl DataProcessor {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
            stats: DataProcessorStats {
                total_records_processed: 0,
                total_searches_performed: 0,
                average_processing_time: 0.0,
                average_search_time: 0.0,
                total_records_indexed: 0,
            },
            processing_times: Vec::new(),
            search_times: Vec::new(),
        }
    }

    pub fn process_cutoff_data(&mut self, json_data: &str) -> Result<String, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        // Parse JSON data
        let records: Vec<CutoffRecord> = serde_json::from_str(json_data)?;
        
        // Process records in parallel
        let processed_records: Vec<CutoffRecord> = records
            .par_iter()
            .map(|record| self.process_record(record))
            .collect();
        
        // Update internal records
        self.records.extend(processed_records);
        
        let processing_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_records_processed += records.len() as u64;
        self.stats.total_records_indexed = self.records.len() as u64;
        self.processing_times.push(processing_time);
        self.update_average_processing_time();
        
        // Return processed data
        serde_json::to_string(&self.records)
            .map_err(|e| format!("Serialization error: {}", e).into())
    }

    pub fn search_cutoffs(&mut self, filters_json: &str, limit: usize) -> Result<String, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        // Parse filters
        let filters: CutoffFilters = serde_json::from_str(filters_json)?;
        
        // Filter records in parallel
        let filtered_records: Vec<&CutoffRecord> = self.records
            .par_iter()
            .filter(|record| self.matches_filters(record, &filters))
            .collect();
        
        // Sort by opening rank
        let mut sorted_records = filtered_records;
        sorted_records.sort_by_key(|record| record.opening_rank);
        
        // Take top results and clone them to avoid borrowing issues
        let results: Vec<CutoffRecord> = sorted_records.into_iter().take(limit).map(|r| (*r).clone()).collect();
        
        let search_time = start_time.elapsed().as_secs_f64() * 1000.0; // Convert to milliseconds
        
        // Update statistics
        self.stats.total_searches_performed += 1;
        self.search_times.push(search_time);
        self.update_average_search_time();
        
        // Return results
        serde_json::to_string(&results)
            .map_err(|e| format!("Serialization error: {}", e).into())
    }

    fn process_record(&self, record: &CutoffRecord) -> CutoffRecord {
        // Apply any data processing logic here
        // For now, just return the record as-is
        CutoffRecord {
            id: record.id.clone(),
            college_id: record.college_id.clone(),
            college_name: record.college_name.clone(),
            course_id: record.course_id.clone(),
            course_name: record.course_name.clone(),
            year: record.year,
            round: record.round,
            opening_rank: record.opening_rank,
            closing_rank: record.closing_rank,
            category: record.category.clone(),
            state: record.state.clone(),
            counselling_body: record.counselling_body.clone(),
            level: record.level.clone(),
            stream: record.stream.clone(),
        }
    }

    fn matches_filters(&self, record: &CutoffRecord, filters: &CutoffFilters) -> bool {
        if let Some(year) = filters.year {
            if record.year != year {
                return false;
            }
        }
        
        if let Some(round) = filters.round {
            if record.round != round {
                return false;
            }
        }
        
        if let Some(ref state) = filters.state {
            if !record.state.to_lowercase().contains(&state.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(ref course) = filters.course {
            if !record.course_name.to_lowercase().contains(&course.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(ref college) = filters.college {
            if !record.college_name.to_lowercase().contains(&college.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(min_rank) = filters.min_rank {
            if record.opening_rank < min_rank {
                return false;
            }
        }
        
        if let Some(max_rank) = filters.max_rank {
            if record.closing_rank > max_rank {
                return false;
            }
        }
        
        if let Some(ref category) = filters.category {
            if !record.category.to_lowercase().contains(&category.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(ref counselling_body) = filters.counselling_body {
            if !record.counselling_body.to_lowercase().contains(&counselling_body.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(ref level) = filters.level {
            if !record.level.to_lowercase().contains(&level.to_lowercase()) {
                return false;
            }
        }
        
        if let Some(ref stream) = filters.stream {
            if !record.stream.to_lowercase().contains(&stream.to_lowercase()) {
                return false;
            }
        }
        
        true
    }

    fn update_average_processing_time(&mut self) {
        if !self.processing_times.is_empty() {
            self.stats.average_processing_time = 
                self.processing_times.iter().sum::<f64>() / self.processing_times.len() as f64;
        }
    }

    fn update_average_search_time(&mut self) {
        if !self.search_times.is_empty() {
            self.stats.average_search_time = 
                self.search_times.iter().sum::<f64>() / self.search_times.len() as f64;
        }
    }

    pub fn get_stats(&self) -> &DataProcessorStats {
        &self.stats
    }

    pub fn clear_data(&mut self) {
        self.records.clear();
        self.stats = DataProcessorStats {
            total_records_processed: 0,
            total_searches_performed: 0,
            average_processing_time: 0.0,
            average_search_time: 0.0,
            total_records_indexed: 0,
        };
        self.processing_times.clear();
        self.search_times.clear();
    }
}
