// WebAssembly data processor module for handling compressed Parquet data
// This module provides high-performance data processing capabilities for the Edge-Native + AI architecture

// Global variables
let g_records = null;
let g_record_count = 0;
let g_hash_index = null;
let g_hash_count = 0;

// Memory management
function allocateMemory(size) {
  return Module._malloc(size);
}

function freeMemory(ptr) {
  return Module._free(ptr);
}

// Data structures
const CutoffRecord = {
  college_id: 0,
  college_name: 1,
  college_type: 2,
  stream: 3,
  state_id: 4,
  state_name: 5,
  course_id: 6,
  course_name: 7,
  year: 8,
  level: 9,
  counselling_body: 10,
  round: 11,
  quota_id: 12,
  quota_name: 13,
  category_id: 14,
  category_name: 15,
  opening_rank: 16,
  closing_rank: 17,
  total_seats: 18,
  ranks: 19,
  embedding: 20,
  prediction_score: 21,
  trend_direction: 22,
  recommendation_rank: 23
};

// Hash function for fast lookups
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash;
}

// LZ4 decompression (simplified)
function decompressLZ4(compressedData, compressedSize) {
  // For now, return compressed data as-is
  // In production, this would use proper LZ4 decompression
  const decompressedSize = compressedSize;
  const decompressedData = allocateMemory(decompressedSize);
  
  // Copy data
  for (let i = 0; i < compressedSize; i++) {
    Module.HEAPU8[decompressedData + i] = Module.HEAPU8[compressedData + i];
  }
  
  return decompressedData;
}

// Process individual record
function processRecord(recordPtr) {
  // Calculate hashes for fast lookup
  const collegeIdHash = hashString(getString(recordPtr + CutoffRecord.college_id));
  const courseIdHash = hashString(getString(recordPtr + CutoffRecord.course_id));
  const categoryIdHash = hashString(getString(recordPtr + CutoffRecord.category_id));
  
  // Store hashes in record
  Module.HEAPU32[recordPtr + CutoffRecord.college_id_hash] = collegeIdHash;
  Module.HEAPU32[recordPtr + CutoffRecord.course_id_hash] = courseIdHash;
  Module.HEAPU32[recordPtr + CutoffRecord.category_id_hash] = categoryIdHash;
  
  // Calculate trend direction
  const openingRank = Module.HEAPU32[recordPtr + CutoffRecord.opening_rank];
  const closingRank = Module.HEAPU32[recordPtr + CutoffRecord.closing_rank];
  
  let trendDirection = 22; // stable
  if (closingRank < openingRank * 0.9) {
    trendDirection = 20; // down
  } else if (closingRank > openingRank * 1.1) {
    trendDirection = 19; // up
  }
  
  Module.HEAPU8[recordPtr + CutoffRecord.trend_direction] = trendDirection;
  
  // Calculate prediction score
  const rankFactor = 1.0 - (closingRank / 100000.0);
  const seatsFactor = (Module.HEAPU32[recordPtr + CutoffRecord.total_seats] / 100.0);
  const predictionScore = rankFactor * seatsFactor;
  
  Module.HEAPF32[recordPtr + CutoffRecord.prediction_score] = predictionScore;
  
  // Calculate recommendation rank
  Module.HEAPU32[recordPtr + CutoffRecord.recommendation_rank] = Math.floor(predictionScore * 1000);
}

// Main processing function
function processCutoffData(compressedData, compressedSize, outputBuffer) {
  // Decompress data
  const decompressedSize = compressedSize;
  const decompressedData = decompressLZ4(compressedData, compressedSize);
  
  // Parse Parquet data (simplified)
  const recordSize = 200; // Estimated record size
  const recordCount = Math.floor(decompressedSize / recordSize);
  
  // Allocate memory for records
  const recordsPtr = allocateMemory(recordCount * 200); // 200 bytes per record
  
  // Process records
  for (let i = 0; i < recordCount; i++) {
    const recordPtr = recordsPtr + (i * 200);
    processRecord(recordPtr);
  }
  
  return 0; // Success
}

// Search functions
function searchCutoffsByCollege(collegeHash, results, maxResults) {
  let count = 0;
  
  for (let i = 0; i < g_record_count && count < maxResults; i++) {
    const recordPtr = g_records + (i * 200);
    
    if (Module.HEAPU32[recordPtr + CutoffRecord.college_id_hash] === collegeHash) {
      Module.HEAPU32[results + (count * 4)] = i;
      count++;
    }
  }
  
  return count;
}

function searchCutoffsByCourse(courseHash, results, maxResults) {
  let count = 0;
  
  for (let i = 0; i < g_record_count && count < maxResults; i++) {
    const recordPtr = g_records + (i * 200);
    
    if (Module.HEAPU32[recordPtr + CutoffRecord.course_id_hash] === courseHash) {
      Module.HEAPU32[results + (count * 4)] = i;
      count++;
    }
  }
  
  return count;
}

function searchCutoffsByCategory(categoryHash, results, maxResults) {
  let count = 0;
  
  for (let i = 0; i < g_record_count && count < maxResults; i++) {
    const recordPtr = g_records + (i * 200);
    
    if (Module.HEAPU32[recordPtr + CutoffRecord.category_id_hash] === categoryHash) {
      Module.HEAPU32[results + (count * 4)] = i;
      count++;
    }
  }
  
  return count;
}

// Vector similarity search
function vectorSimilarity(vec1, vec2, dimensions) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // Calculate dot product
  for (let i = 0; i < dimensions; i++) {
    dotProduct += Module.HEAPF32[vec1 + (i * 4)] * Module.HEAPF32[vec2 + (i * 4)];
    norm1 += Module.HEAPF32[vec1 + (i * 4)] * Module.HEAPF32[vec1 + (i * 4)];
    norm2 += Module.HEAPF32[vec2 + (i * 4)] * Module.HEAPF32[vec2 + (i * 4)];
  }
  
  // Calculate cosine similarity
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Export functions for JavaScript
Module.onRuntimeInitialized = function() {
  console.log('WebAssembly data processor initialized');
};

Module._processCutoffData = function(compressedData, compressedSize, outputBuffer) {
  try {
    const result = processCutoffData(compressedData, compressedSize, outputBuffer);
    return result;
  } catch (error) {
    console.error('Error processing cutoff data:', error);
    return -1;
  }
};

Module._searchCutoffsByCollege = function(collegeHash, maxResults) {
  const results = allocateMemory(maxResults * 4);
  const count = searchCutoffsByCollege(collegeHash, results, maxResults);
  
  return count;
};

Module._searchCutoffsByCourse = function(courseHash, maxResults) {
  const results = allocateMemory(maxResults * 4);
  const count = searchCutoffsByCourse(courseHash, results, maxResults);
  
  return count;
};

Module._searchCutoffsByCategory = function(categoryHash, maxResults) {
  const results = allocateMemory(maxResults * 4);
  const count = searchCutoffsByCategory(categoryHash, results, maxResults);
  
  return count;
};

Module._init = function() {
  g_records = null;
  g_record_count = 0;
  g_hash_index = null;
  g_hash_count = 0;
  
  console.log('WebAssembly data processor initialized');
  return 0;
};

Module._cleanup = function() {
  if (g_records) {
    freeMemory(g_records);
    g_records = null;
  }
  
  if (g_hash_index) {
    freeMemory(g_hash_index);
    g_hash_index = null;
  }
  
  g_record_count = 0;
  g_hash_count = 0;
  
  console.log('WebAssembly data processor cleaned up');
};
