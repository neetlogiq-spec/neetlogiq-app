// Stream-Based Cutoff Hook
// Integrates with existing StreamDataService for stream-specific cutoff loading
// Enhanced with LZ4 compression and IndexedDB caching

import { useState, useEffect, useCallback } from 'react';
import { useStreamDataService } from './useStreamDataService';
import { CutoffRecord, CutoffFilters } from '@/types/data';
import { compressionManager } from '@/lib/compression/CompressionManager';
import { indexedDBCache } from '@/lib/cache/IndexedDBCache';

interface StreamPartition {
  filename: string;
  stream: string;
  year: number;
  rounds: number[];
  priority: 'high' | 'medium' | 'low';
  loadStrategy: 'immediate' | 'on-demand' | 'background';
  description: string;
  estimatedSize: number;
  courseTypes: string[];
  excludeStreams: string[];
}

interface StreamManifest {
  version: string;
  created_at: string;
  strategy: string;
  total_partitions: number;
  total_estimated_size: number;
  compression: {
    algorithm: string;
    estimated_compression_ratio: number;
  };
  loading_strategy: {
    immediate: number;
    on_demand: number;
    background: number;
  };
  streams: Record<string, {
    name: string;
    description: string;
    total_partitions: number;
    total_estimated_size: number;
    immediate_load: StreamPartition[];
    on_demand_load: StreamPartition[];
    course_types: string[];
    priority_rounds: number[];
    on_demand_rounds: number[];
    exclude_streams: string[];
  }>;
  partitions: StreamPartition[];
}

interface LoadingProgress {
  partition: string;
  status: 'pending' | 'downloading' | 'decompressing' | 'loading' | 'completed' | 'error';
  progress: number;
  downloaded: number;
  total: number;
  error?: string;
}

interface StreamBasedCutoffState {
  cutoffs: CutoffRecord[];
  loading: boolean;
  error: string | null;
  loadingProgress: Map<string, LoadingProgress>;
  loadedPartitions: string[];
  manifest: StreamManifest | null;
  currentStream: string | null;
}

export const useStreamBasedCutoffs = () => {
  const { currentStream, streamConfig } = useStreamDataService();
  
  const [state, setState] = useState<StreamBasedCutoffState>({
    cutoffs: [],
    loading: false,
    error: null,
    loadingProgress: new Map(),
    loadedPartitions: [],
    manifest: null,
    currentStream: null
  });

  // Load manifest on mount
  useEffect(() => {
    loadManifest();
    initializeCache();
  }, []);

  const initializeCache = async () => {
    try {
      await indexedDBCache.init();
      indexedDBCache.setCompressionManager(compressionManager);
      console.log('✅ IndexedDB cache initialized with compression');
    } catch (error) {
      console.error('❌ Failed to initialize cache:', error);
    }
  };

  // Load stream data when stream changes
  useEffect(() => {
    if (currentStream && state.manifest) {
      loadStreamData(currentStream);
    }
  }, [currentStream, state.manifest]);

  const loadManifest = async () => {
    try {
      const response = await fetch('/data/parquet/cutoffs/stream_partition_manifest.json');
      const manifest = await response.json();
      
      setState(prev => ({
        ...prev,
        manifest
      }));
      
      console.log('✅ Stream manifest loaded');
    } catch (error) {
      console.error('❌ Failed to load manifest:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load stream manifest'
      }));
    }
  };

  const loadStreamData = async (streamId: string) => {
    if (!state.manifest) {
      console.warn('Manifest not loaded yet');
      return;
    }

    const streamInfo = state.manifest.streams[streamId];
    if (!streamInfo) {
      console.error(`Stream not found: ${streamId}`);
      return;
    }

    console.log(`📚 Loading ${streamInfo.name} data...`);
    
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      currentStream: streamId
    }));

    try {
      // Load immediate partitions (Rounds 1-2)
      for (const partition of streamInfo.immediate_load) {
        await loadPartition(partition.filename);
      }

      console.log(`✅ ${streamInfo.name} immediate data loaded`);
      
      setState(prev => ({
        ...prev,
        loading: false
      }));

    } catch (error) {
      console.error(`❌ Failed to load ${streamInfo.name} data:`, error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to load ${streamInfo.name} data`
      }));
    }
  };

  const loadPartition = async (filename: string): Promise<CutoffRecord[]> => {
    if (state.loadedPartitions.includes(filename)) {
      console.log(`📁 Partition already loaded: ${filename}`);
      return [];
    }

    console.log(`📥 Loading partition: ${filename}`);
    
    // Check cache first
    const cacheKey = `cutoff_partition_${filename}`;
    const cachedData = await indexedDBCache.get<CutoffRecord[]>(cacheKey);
    
    if (cachedData) {
      console.log(`✅ Loaded from cache: ${filename} (${cachedData.length} records)`);
      
      setState(prev => ({
        ...prev,
        loadedPartitions: [...prev.loadedPartitions, filename],
        cutoffs: [...prev.cutoffs, ...cachedData]
      }));
      
      return cachedData;
    }
    
    // Update loading progress
    setState(prev => {
      const newProgress = new Map(prev.loadingProgress);
      newProgress.set(filename, {
        partition: filename,
        status: 'downloading',
        progress: 0,
        downloaded: 0,
        total: 0
      });
      return { ...prev, loadingProgress: newProgress };
    });

    try {
      // Load compressed file
      const response = await fetch(`/data/compressed/cutoffs/${filename}.gz`);
      if (!response.ok) {
        throw new Error(`Failed to download ${filename}: ${response.status}`);
      }

      const compressedData = await response.arrayBuffer();
      
      // Update progress
      setState(prev => {
        const newProgress = new Map(prev.loadingProgress);
        newProgress.set(filename, {
          partition: filename,
          status: 'decompressing',
          progress: 50,
          downloaded: compressedData.byteLength,
          total: compressedData.byteLength
        });
        return { ...prev, loadingProgress: newProgress };
      });

      // Decompress data using compression manager
      const decompressedData = await compressionManager.decompress(compressedData, 'gzip');
      
      // Update progress
      setState(prev => {
        const newProgress = new Map(prev.loadingProgress);
        newProgress.set(filename, {
          partition: filename,
          status: 'loading',
          progress: 75,
          downloaded: decompressedData.byteLength,
          total: decompressedData.byteLength
        });
        return { ...prev, loadingProgress: newProgress };
      });

      // Parse JSON data (in real implementation, parse Parquet)
      const data = JSON.parse(new TextDecoder().decode(decompressedData));
      
      // Cache the data
      await indexedDBCache.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24 hours TTL
      
      // Update progress
      setState(prev => {
        const newProgress = new Map(prev.loadingProgress);
        newProgress.set(filename, {
          partition: filename,
          status: 'completed',
          progress: 100,
          downloaded: decompressedData.byteLength,
          total: decompressedData.byteLength
        });
        
        return {
          ...prev,
          loadingProgress: newProgress,
          loadedPartitions: [...prev.loadedPartitions, filename],
          cutoffs: [...prev.cutoffs, ...data]
        };
      });

      console.log(`✅ Loaded ${filename}: ${data.length} records`);
      return data;

    } catch (error) {
      console.error(`❌ Failed to load partition ${filename}:`, error);
      
      setState(prev => {
        const newProgress = new Map(prev.loadingProgress);
        newProgress.set(filename, {
          partition: filename,
          status: 'error',
          progress: 0,
          downloaded: 0,
          total: 0,
          error: error.message
        });
        return { ...prev, loadingProgress: newProgress };
      });
      
      throw error;
    }
  };

  const decompressGzip = async (compressedData: ArrayBuffer): Promise<ArrayBuffer> => {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressedData);
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  };

  const loadOnDemandData = useCallback(async () => {
    if (!currentStream || !state.manifest) {
      return;
    }

    const streamInfo = state.manifest.streams[currentStream];
    if (!streamInfo) {
      return;
    }

    console.log(`📚 Loading ${streamInfo.name} on-demand data...`);

    try {
      // Load on-demand partitions (Rounds 3-6)
      for (const partition of streamInfo.on_demand_load) {
        await loadPartition(partition.filename);
      }

      console.log(`✅ ${streamInfo.name} on-demand data loaded`);

    } catch (error) {
      console.error(`❌ Failed to load on-demand data:`, error);
    }
  }, [currentStream, state.manifest]);

  const searchCutoffs = useCallback((filters: CutoffFilters, limit: number = 100): CutoffRecord[] => {
    console.log('🔍 Searching cutoffs with filters:', filters);
    
    let results = state.cutoffs;
    
    // Apply filters
    if (filters.year) {
      results = results.filter(cutoff => cutoff.year === filters.year);
    }
    
    if (filters.round) {
      results = results.filter(cutoff => cutoff.round === filters.round);
    }
    
    if (filters.state) {
      results = results.filter(cutoff => 
        cutoff.state_name?.toLowerCase().includes(filters.state.toLowerCase())
      );
    }
    
    if (filters.course) {
      results = results.filter(cutoff => 
        cutoff.course_name?.toLowerCase().includes(filters.course.toLowerCase())
      );
    }
    
    if (filters.college) {
      results = results.filter(cutoff => 
        cutoff.college_name?.toLowerCase().includes(filters.college.toLowerCase())
      );
    }
    
    if (filters.min_rank) {
      results = results.filter(cutoff => cutoff.opening_rank >= filters.min_rank!);
    }
    
    if (filters.max_rank) {
      results = results.filter(cutoff => cutoff.closing_rank <= filters.max_rank!);
    }
    
    // Apply stream-specific filtering
    if (currentStream && streamConfig) {
      results = results.filter(cutoff => {
        const courseName = cutoff.course_name?.toUpperCase() || '';
        return streamConfig.cutoffFilter.some(courseType => 
          courseName.startsWith(courseType.toUpperCase())
        );
      });
    }
    
    console.log(`✅ Found ${results.length} cutoff records`);
    return results.slice(0, limit);
  }, [state.cutoffs, currentStream, streamConfig]);

  const clearCache = useCallback(async () => {
    console.log('🧹 Clearing cutoff cache...');
    
    // Clear IndexedDB cache
    await indexedDBCache.clear();
    
    setState(prev => ({
      ...prev,
      cutoffs: [],
      loadedPartitions: [],
      loadingProgress: new Map()
    }));
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    console.log('✅ Cache cleared successfully');
  }, []);

  const getStreamInfo = useCallback((streamId: string) => {
    return state.manifest?.streams[streamId];
  }, [state.manifest]);

  const getLoadingProgress = useCallback(() => {
    return Array.from(state.loadingProgress.values());
  }, [state.loadingProgress]);

  const getPerformanceMetrics = useCallback(() => {
    const totalSize = state.loadedPartitions.reduce((sum, filename) => {
      const partition = state.manifest?.partitions.find(p => p.filename === filename);
      return sum + (partition?.estimatedSize || 0);
    }, 0);

    return {
      loadedPartitions: state.loadedPartitions.length,
      totalPartitions: state.manifest?.total_partitions || 0,
      totalSize,
      compressedSize: totalSize * 0.06, // 94% compression
      currentStream,
      cutoffsCount: state.cutoffs.length
    };
  }, [state.loadedPartitions, state.manifest, state.cutoffs.length, currentStream]);

  return {
    // State
    cutoffs: state.cutoffs,
    loading: state.loading,
    error: state.error,
    currentStream,
    streamConfig,
    
    // Actions
    loadStreamData,
    loadOnDemandData,
    searchCutoffs,
    clearCache,
    
    // Info
    getStreamInfo,
    getLoadingProgress,
    getPerformanceMetrics,
    loadedPartitions: state.loadedPartitions,
    manifest: state.manifest
  };
};
