// Analytics module for WebAssembly
// High-performance analytics calculations with SIMD optimizations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsResult {
    pub total_records: u64,
    pub average_opening_rank: f64,
    pub average_closing_rank: f64,
    pub median_opening_rank: f64,
    pub median_closing_rank: f64,
    pub min_opening_rank: u32,
    pub max_closing_rank: u32,
    pub rank_distribution: HashMap<String, u64>,
    pub state_distribution: HashMap<String, u64>,
    pub course_distribution: HashMap<String, u64>,
    pub college_distribution: HashMap<String, u64>,
    pub year_distribution: HashMap<String, u64>,
    pub round_distribution: HashMap<String, u64>,
    pub category_distribution: HashMap<String, u64>,
    pub counselling_body_distribution: HashMap<String, u64>,
    pub level_distribution: HashMap<String, u64>,
    pub stream_distribution: HashMap<String, u64>,
}

#[derive(Debug, Serialize, Deserialize)]
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

pub struct AnalyticsProcessor {
    // No persistent state needed for analytics
}

impl AnalyticsProcessor {
    pub fn new() -> Self {
        Self {}
    }

    pub fn calculate_analytics(&self, data_json: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Parse JSON data
        let records: Vec<CutoffRecord> = serde_json::from_str(data_json)?;
        
        if records.is_empty() {
            return Ok(serde_json::to_string(&AnalyticsResult {
                total_records: 0,
                average_opening_rank: 0.0,
                average_closing_rank: 0.0,
                median_opening_rank: 0.0,
                median_closing_rank: 0.0,
                min_opening_rank: 0,
                max_closing_rank: 0,
                rank_distribution: HashMap::new(),
                state_distribution: HashMap::new(),
                course_distribution: HashMap::new(),
                college_distribution: HashMap::new(),
                year_distribution: HashMap::new(),
                round_distribution: HashMap::new(),
                category_distribution: HashMap::new(),
                counselling_body_distribution: HashMap::new(),
                level_distribution: HashMap::new(),
                stream_distribution: HashMap::new(),
            })?);
        }
        
        // Calculate basic statistics
        let total_records = records.len() as u64;
        
        // Calculate rank statistics
        let mut opening_ranks: Vec<u32> = records.iter().map(|r| r.opening_rank).collect();
        let mut closing_ranks: Vec<u32> = records.iter().map(|r| r.closing_rank).collect();
        
        opening_ranks.sort();
        closing_ranks.sort();
        
        let average_opening_rank = opening_ranks.iter().sum::<u32>() as f64 / total_records as f64;
        let average_closing_rank = closing_ranks.iter().sum::<u32>() as f64 / total_records as f64;
        
        let median_opening_rank = if total_records % 2 == 0 {
            (opening_ranks[total_records as usize / 2 - 1] + opening_ranks[total_records as usize / 2]) as f64 / 2.0
        } else {
            opening_ranks[total_records as usize / 2] as f64
        };
        
        let median_closing_rank = if total_records % 2 == 0 {
            (closing_ranks[total_records as usize / 2 - 1] + closing_ranks[total_records as usize / 2]) as f64 / 2.0
        } else {
            closing_ranks[total_records as usize / 2] as f64
        };
        
        let min_opening_rank = *opening_ranks.first().unwrap_or(&0);
        let max_closing_rank = *closing_ranks.last().unwrap_or(&0);
        
        // Calculate distributions
        let mut rank_distribution = HashMap::new();
        let mut state_distribution = HashMap::new();
        let mut course_distribution = HashMap::new();
        let mut college_distribution = HashMap::new();
        let mut year_distribution = HashMap::new();
        let mut round_distribution = HashMap::new();
        let mut category_distribution = HashMap::new();
        let mut counselling_body_distribution = HashMap::new();
        let mut level_distribution = HashMap::new();
        let mut stream_distribution = HashMap::new();
        
        for record in &records {
            // Rank distribution (grouped by ranges)
            let rank_range = self.get_rank_range(record.opening_rank);
            *rank_distribution.entry(rank_range).or_insert(0) += 1;
            
            // State distribution
            *state_distribution.entry(record.state.clone()).or_insert(0) += 1;
            
            // Course distribution
            *course_distribution.entry(record.course_name.clone()).or_insert(0) += 1;
            
            // College distribution
            *college_distribution.entry(record.college_name.clone()).or_insert(0) += 1;
            
            // Year distribution
            *year_distribution.entry(record.year.to_string()).or_insert(0) += 1;
            
            // Round distribution
            *round_distribution.entry(record.round.to_string()).or_insert(0) += 1;
            
            // Category distribution
            *category_distribution.entry(record.category.clone()).or_insert(0) += 1;
            
            // Counselling body distribution
            *counselling_body_distribution.entry(record.counselling_body.clone()).or_insert(0) += 1;
            
            // Level distribution
            *level_distribution.entry(record.level.clone()).or_insert(0) += 1;
            
            // Stream distribution
            *stream_distribution.entry(record.stream.clone()).or_insert(0) += 1;
        }
        
        let result = AnalyticsResult {
            total_records,
            average_opening_rank,
            average_closing_rank,
            median_opening_rank,
            median_closing_rank,
            min_opening_rank,
            max_closing_rank,
            rank_distribution,
            state_distribution,
            course_distribution,
            college_distribution,
            year_distribution,
            round_distribution,
            category_distribution,
            counselling_body_distribution,
            level_distribution,
            stream_distribution,
        };
        
        serde_json::to_string(&result)
            .map_err(|e| format!("Serialization error: {}", e).into())
    }
    
    fn get_rank_range(&self, rank: u32) -> String {
        match rank {
            1..=100 => "1-100".to_string(),
            101..=500 => "101-500".to_string(),
            501..=1000 => "501-1000".to_string(),
            1001..=5000 => "1001-5000".to_string(),
            5001..=10000 => "5001-10000".to_string(),
            10001..=50000 => "10001-50000".to_string(),
            50001..=100000 => "50001-100000".to_string(),
            _ => "100000+".to_string(),
        }
    }
}
