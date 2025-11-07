// WebAssembly vector search module for AI-powered semantic search
// This module provides high-performance vector similarity search with SIMD optimizations

// Global variables
let g_embeddings = null;
let g_embedding_count = 0;
let g_embedding_dimensions = 384;

// Memory management
function allocateMemory(size) {
  return Module._malloc(size);
}

function freeMemory(ptr) {
  return Module._free(ptr);
}

// Vector similarity with SIMD
function vectorSimilarity(vec1, vec2, dimensions) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // SIMD-optimized dot product calculation
  const simdSize = 4; // Process 4 floats at a time
  const iterations = Math.floor(dimensions / simdSize);
  
  for (let i = 0; i < iterations; i++) {
    const offset = i * simdSize;
    
    // Load 4 floats at a time
    const v1_0 = Module.HEAPF32[vec1 + offset];
    const v1_1 = Module.HEAPF32[vec1 + offset + 4];
    const v1_2 = Module.HEAPF32[vec1 + offset + 8];
    const v1_3 = Module.HEAPF32[vec1 + offset + 12];
    
    const v2_0 = Module.HEAPF32[vec2 + offset];
    const v2_1 = Module.HEAPF32[vec2 + offset + 4];
    const v2_2 = Module.HEAPF32[vec2 + offset + 8];
    const v2_3 = Module.HEAPF32[vec2 + offset + 12];
    
    // SIMD dot product
    const dp0 = v1_0 * v2_0 + v1_1 * v2_1 + v1_2 * v2_2 + v1_3 * v2_3;
    const dp1 = v1_0 * v2_0 + v1_1 * v2_1 + v1_2 * v2_2 + v1_3 * v2_3;
    
    dotProduct += dp0 + dp1;
    norm1 += v1_0 * v1_0 + v1_1 * v1_1 + v1_2 * v1_2 + v1_3 * v1_3;
    norm2 += v2_0 * v2_0 + v2_1 * v2_1 + v2_2 * v2_3;
  }
  
  // Handle remaining elements
  for (let i = iterations * simdSize; i < dimensions; i++) {
    const v1_val = Module.HEAPF32[vec1 + i];
    const v2_val = Module.HEAPF32[vec2 + i];
    
    dotProduct += v1_val * v2_val;
    norm1 += v1_val * v1_val;
    norm2 += v2_val * v2_val;
  }
  
  // Calculate cosine similarity
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Load embeddings
function loadEmbeddings(embeddingsData, dimensions) {
  g_embeddings = embeddingsData;
  g_embedding_count = embeddingsData.length / dimensions;
  g_embedding_dimensions = dimensions;
  
  console.log('Embeddings loaded:', g_embedding_count, 'vectors');
}

// Search by similarity
function searchBySimilarity(queryVector, maxResults) {
  if (!g_embeddings) {
    return [];
  }
  
  const results = [];
  const queryPtr = allocateMemory(queryVector.length * 4);
  
  // Copy query vector to WebAssembly memory
  for (let i = 0; i < queryVector.length; i++) {
    Module.HEAPF32[queryPtr + i] = queryVector[i];
  }
  
  // Search through all embeddings
  for (let i = 0; i < g_embedding_count; i++) {
    const embeddingPtr = i * g_embedding_dimensions * 4;
    
    // Calculate similarity
    const similarity = vectorSimilarity(
      queryPtr,
      embeddingPtr,
      g_embedding_dimensions
    );
    
    if (similarity > 0.7) { // Similarity threshold
      const resultPtr = allocateMemory(8);
      
      // Store result (index, similarity)
      Module.HEAPU32[resultPtr] = i;
      Module.HEAPF32[resultPtr + 4] = similarity;
      
      results.push(resultPtr);
    }
  }
  
  // Sort results by similarity (descending)
  results.sort((a, b) => {
    const simA = Module.HEAPF32[a + 4];
    const simB = Module.HEAPF32[b + 4];
    return simB - simA;
  });
  
  // Return top results
  const topResults = results.slice(0, maxResults);
  const resultArray = new Array(topResults.length);
  
  for (let i = 0; i < topResults.length; i++) {
    const resultPtr = topResults[i];
    const index = Module.HEAPU32[resultPtr];
    resultArray[i] = index;
  }
  
  // Clean up
  freeMemory(queryPtr);
  
  return resultArray;
}

// Export functions for JavaScript
Module.onRuntimeInitialized = function() {
  console.log('Vector search WebAssembly initialized');
};

Module._loadEmbeddings = function(embeddingsData, dimensions) {
  loadEmbeddings(embeddingsData, dimensions);
  return 0;
};

Module._searchBySimilarity = function(queryVector, maxResults) {
  const results = searchBySimilarity(queryVector, maxResults);
  return results;
};

Module._cleanup = function() {
  if (g_embeddings) {
    freeMemory(g_embeddings);
    g_embeddings = null;
    g_embedding_count = 0;
    g_embedding_dimensions = 0;
  }
  
  console.log('Vector search WebAssembly cleaned up');
};
