/**
 * React Hook for Configuration Metadata
 *
 * Provides easy access to data-driven configuration metadata.
 * All values are automatically detected from data, no hardcoding!
 */

import { useState, useEffect } from 'react';
import { getConfigMetadataService } from '@/services/ConfigMetadataService';

/**
 * Hook to get available years
 */
export function useAvailableYears() {
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfigMetadataService()
      .getAvailableYears()
      .then(setYears)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { years, loading };
}

/**
 * Hook to get available rounds for a year
 */
export function useAvailableRounds(year: number | null) {
  const [rounds, setRounds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!year) {
      setLoading(false);
      return;
    }

    getConfigMetadataService()
      .getAvailableRounds(year)
      .then(setRounds)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  return { rounds, loading };
}

/**
 * Hook to get filter options
 */
export function useFilterOptions() {
  const [options, setOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfigMetadataService()
      .getFilterOptions()
      .then(setOptions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { options, loading };
}

/**
 * Hook to get colleges for a stream
 */
export function useCollegesByStream(stream: string | null) {
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stream) {
      setLoading(false);
      return;
    }

    getConfigMetadataService()
      .getCollegesByStream(stream)
      .then(data => setColleges(data.colleges))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [stream]);

  return { colleges, loading };
}

/**
 * Hook to get courses for a stream
 */
export function useCoursesByStream(stream: string | null) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stream) {
      setLoading(false);
      return;
    }

    getConfigMetadataService()
      .getCoursesByStream(stream)
      .then(data => setCourses(data.courses))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [stream]);

  return { courses, loading };
}

/**
 * Hook to check for data updates and auto-refresh if needed
 */
export function useDataVersionCheck(options = { checkInterval: 300000 }) {
  const [hasUpdates, setHasUpdates] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('unknown');
  const [latestVersion, setLatestVersion] = useState<string>('unknown');

  useEffect(() => {
    const checkUpdates = async () => {
      const result = await getConfigMetadataService().checkForUpdates();
      setHasUpdates(result.hasUpdates);
      setCurrentVersion(result.currentVersion);
      setLatestVersion(result.latestVersion);

      if (result.hasUpdates) {
        console.log('New data version available:', result.latestVersion);
      }
    };

    // Check on mount
    checkUpdates();

    // Check periodically
    const interval = setInterval(checkUpdates, options.checkInterval);

    return () => clearInterval(interval);
  }, [options.checkInterval]);

  const updateNow = async () => {
    await getConfigMetadataService().updateToLatestVersion();
    window.location.reload();
  };

  return {
    hasUpdates,
    currentVersion,
    latestVersion,
    updateNow
  };
}

/**
 * Hook to get statistics
 */
export function useStatistics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfigMetadataService()
      .getStatistics()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
