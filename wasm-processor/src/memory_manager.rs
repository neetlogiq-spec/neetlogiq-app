// Memory manager module for WebAssembly
// Efficient memory management and garbage collection

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryStats {
    pub used_memory: u64,
    pub total_memory: u64,
    pub available_memory: u64,
    pub memory_pressure: f64, // 0.0 to 1.0
    pub gc_count: u64,
    pub last_gc_time: f64,
    pub allocation_count: u64,
    pub deallocation_count: u64,
}

pub struct MemoryManager {
    stats: MemoryStats,
    allocations: HashMap<String, usize>,
}

impl MemoryManager {
    pub fn new() -> Self {
        Self {
            stats: MemoryStats {
                used_memory: 0,
                total_memory: 0,
                available_memory: 0,
                memory_pressure: 0.0,
                gc_count: 0,
                last_gc_time: 0.0,
                allocation_count: 0,
                deallocation_count: 0,
            },
            allocations: HashMap::new(),
        }
    }

    pub fn get_usage_stats(&self) -> &MemoryStats {
        &self.stats
    }

    pub fn allocate(&mut self, identifier: String, size: usize) {
        self.allocations.insert(identifier, size);
        self.stats.used_memory += size as u64;
        self.stats.allocation_count += 1;
        self.update_memory_pressure();
    }

    pub fn deallocate(&mut self, identifier: &str) -> Option<usize> {
        if let Some(size) = self.allocations.remove(identifier) {
            self.stats.used_memory = self.stats.used_memory.saturating_sub(size as u64);
            self.stats.deallocation_count += 1;
            self.update_memory_pressure();
            Some(size)
        } else {
            None
        }
    }

    pub fn clear_all(&mut self) {
        self.allocations.clear();
        self.stats.used_memory = 0;
        self.stats.gc_count += 1;
        self.stats.last_gc_time = js_sys::Date::now();
        self.update_memory_pressure();
    }

    fn update_memory_pressure(&mut self) {
        // Estimate memory pressure based on used memory
        // This is a simplified calculation
        if self.stats.total_memory > 0 {
            self.stats.memory_pressure = self.stats.used_memory as f64 / self.stats.total_memory as f64;
        } else {
            self.stats.memory_pressure = 0.0;
        }
        
        self.stats.available_memory = self.stats.total_memory.saturating_sub(self.stats.used_memory);
    }

    pub fn get_allocation_count(&self) -> usize {
        self.allocations.len()
    }

    pub fn get_total_allocated_size(&self) -> usize {
        self.allocations.values().sum()
    }
}
