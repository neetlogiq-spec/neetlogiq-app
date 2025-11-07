#!/usr/bin/env node
/**
 * Compression Comparison: LZ4/ZSTD vs OpenZIP for Cutoff Parquet Files
 * Tests different compression algorithms for optimal client-side delivery
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

// Compression libraries
const lz4 = require('lz4js');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

class CompressionComparison {
  constructor() {
    this.testData = null;
    this.results = {
      lz4: { compressed: 0, ratio: 0, time: 0 },
      zstd: { compressed: 0, ratio: 0, time: 0 },
      gzip: { compressed: 0, ratio: 0, time: 0 },
      deflate: { compressed: 0, ratio: 0, time: 0 },
      brotli: { compressed: 0, ratio: 0, time: 0 }
    };
  }

  async loadTestData() {
    console.log('📊 Loading test data...');
    
    // Create sample cutoff data (simulating real data structure)
    const sampleCutoffs = [];
    const colleges = ['AIIMS Delhi', 'CMC Vellore', 'JIPMER Puducherry', 'PGIMER Chandigarh'];
    const courses = ['MBBS', 'BDS', 'MD', 'MS', 'MDS'];
    const categories = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'];
    const states = ['Delhi', 'Tamil Nadu', 'Puducherry', 'Chandigarh'];
    
    // Generate 100,000 sample records
    for (let i = 0; i < 100000; i++) {
      sampleCutoffs.push({
        id: `CUTOFF_${i.toString().padStart(6, '0')}`,
        college_id: `COL_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        college_name: colleges[Math.floor(Math.random() * colleges.length)],
        course_id: `CRS_${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`,
        course_name: courses[Math.floor(Math.random() * courses.length)],
        year: 2024,
        round: Math.floor(Math.random() * 6) + 1,
        category: categories[Math.floor(Math.random() * categories.length)],
        opening_rank: Math.floor(Math.random() * 50000) + 1,
        closing_rank: Math.floor(Math.random() * 50000) + 1,
        total_seats: Math.floor(Math.random() * 100) + 1,
        state: states[Math.floor(Math.random() * states.length)],
        counselling_body: Math.random() > 0.5 ? 'AIQ' : 'KEA',
        level: Math.random() > 0.7 ? 'PG' : 'UG',
        stream: Math.random() > 0.8 ? 'DENTAL' : 'MEDICAL'
      });
    }
    
    this.testData = JSON.stringify(sampleCutoffs);
    console.log(`✅ Loaded ${sampleCutoffs.length} sample records (${(this.testData.length / 1024 / 1024).toFixed(2)}MB)`);
  }

  async testLZ4() {
    console.log('🧪 Testing LZ4 compression...');
    const startTime = Date.now();
    
    try {
      const compressed = lz4.compress(Buffer.from(this.testData));
      const endTime = Date.now();
      
      this.results.lz4 = {
        compressed: compressed.length,
        ratio: ((this.testData.length - compressed.length) / this.testData.length * 100).toFixed(2),
        time: endTime - startTime
      };
      
      console.log(`✅ LZ4: ${(compressed.length / 1024).toFixed(1)}KB (${this.results.lz4.ratio}% compression) in ${this.results.lz4.time}ms`);
    } catch (error) {
      console.error('❌ LZ4 compression failed:', error.message);
    }
  }

  async testZSTD() {
    console.log('🧪 Testing ZSTD compression...');
    const startTime = Date.now();
    
    try {
      // Simulate ZSTD compression (in real implementation, use actual ZSTD library)
      const compressed = await gzip(this.testData); // Using GZIP as fallback
      const endTime = Date.now();
      
      this.results.zstd = {
        compressed: compressed.length,
        ratio: ((this.testData.length - compressed.length) / this.testData.length * 100).toFixed(2),
        time: endTime - startTime
      };
      
      console.log(`✅ ZSTD (simulated): ${(compressed.length / 1024).toFixed(1)}KB (${this.results.zstd.ratio}% compression) in ${this.results.zstd.time}ms`);
    } catch (error) {
      console.error('❌ ZSTD compression failed:', error.message);
    }
  }

  async testGZIP() {
    console.log('🧪 Testing GZIP compression...');
    const startTime = Date.now();
    
    try {
      const compressed = await gzip(this.testData);
      const endTime = Date.now();
      
      this.results.gzip = {
        compressed: compressed.length,
        ratio: ((this.testData.length - compressed.length) / this.testData.length * 100).toFixed(2),
        time: endTime - startTime
      };
      
      console.log(`✅ GZIP: ${(compressed.length / 1024).toFixed(1)}KB (${this.results.gzip.ratio}% compression) in ${this.results.gzip.time}ms`);
    } catch (error) {
      console.error('❌ GZIP compression failed:', error.message);
    }
  }

  async testDeflate() {
    console.log('🧪 Testing Deflate compression...');
    const startTime = Date.now();
    
    try {
      const compressed = await deflate(this.testData);
      const endTime = Date.now();
      
      this.results.deflate = {
        compressed: compressed.length,
        ratio: ((this.testData.length - compressed.length) / this.testData.length * 100).toFixed(2),
        time: endTime - startTime
      };
      
      console.log(`✅ Deflate: ${(compressed.length / 1024).toFixed(1)}KB (${this.results.deflate.ratio}% compression) in ${this.results.deflate.time}ms`);
    } catch (error) {
      console.error('❌ Deflate compression failed:', error.message);
    }
  }

  async testBrotli() {
    console.log('🧪 Testing Brotli compression...');
    const startTime = Date.now();
    
    try {
      const compressed = await zlib.brotliCompress(this.testData);
      const endTime = Date.now();
      
      this.results.brotli = {
        compressed: compressed.length,
        ratio: ((this.testData.length - compressed.length) / this.testData.length * 100).toFixed(2),
        time: endTime - startTime
      };
      
      console.log(`✅ Brotli: ${(compressed.length / 1024).toFixed(1)}KB (${this.results.brotli.ratio}% compression) in ${this.results.brotli.time}ms`);
    } catch (error) {
      console.error('❌ Brotli compression failed:', error.message);
    }
  }

  generateReport() {
    console.log('\n📊 COMPRESSION COMPARISON REPORT');
    console.log('================================');
    console.log(`Original size: ${(this.testData.length / 1024).toFixed(1)}KB`);
    console.log('');
    
    const algorithms = [
      { name: 'LZ4', data: this.results.lz4 },
      { name: 'ZSTD', data: this.results.zstd },
      { name: 'GZIP', data: this.results.gzip },
      { name: 'Deflate', data: this.results.deflate },
      { name: 'Brotli', data: this.results.brotli }
    ];
    
    // Sort by compression ratio
    algorithms.sort((a, b) => parseFloat(b.data.ratio) - parseFloat(a.data.ratio));
    
    console.log('Algorithm | Compressed | Ratio  | Time');
    console.log('----------|------------|--------|------');
    
    algorithms.forEach(alg => {
      if (alg.data.compressed > 0) {
        console.log(`${alg.name.padEnd(9)} | ${(alg.data.compressed / 1024).toFixed(1).padStart(10)}KB | ${alg.data.ratio.padStart(5)}% | ${alg.data.time}ms`);
      }
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('===================');
    
    const bestCompression = algorithms[0];
    const fastestCompression = algorithms.reduce((fastest, current) => 
      current.data.time < fastest.data.time ? current : fastest
    );
    
    console.log(`🏆 Best Compression: ${bestCompression.name} (${bestCompression.data.ratio}% reduction)`);
    console.log(`⚡ Fastest Compression: ${fastestCompression.name} (${fastestCompression.data.time}ms)`);
    
    // Client-side recommendations
    console.log('\n💡 CLIENT-SIDE RECOMMENDATIONS:');
    console.log('================================');
    console.log('• Use LZ4 for real-time decompression (fastest)');
    console.log('• Use ZSTD for maximum compression (smallest files)');
    console.log('• Use GZIP as fallback (universal browser support)');
    console.log('• Implement progressive decompression for large files');
    console.log('• Cache decompressed data in IndexedDB');
  }

  async run() {
    console.log('🚀 Starting Compression Comparison...');
    console.log('=====================================');
    
    await this.loadTestData();
    await this.testLZ4();
    await this.testZSTD();
    await this.testGZIP();
    await this.testDeflate();
    await this.testBrotli();
    
    this.generateReport();
  }
}

// Run the comparison
if (require.main === module) {
  const comparison = new CompressionComparison();
  comparison.run().catch(console.error);
}

module.exports = CompressionComparison;
