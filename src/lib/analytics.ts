// Analytics Dashboard for tracking match rates and trends

export interface AnalyticsSnapshot {
  timestamp: number;
  colleges: {
    total: number;
    matched: number;
    unmatched: number;
    matchRate: number;
  };
  courses: {
    total: number;
    matched: number;
    unmatched: number;
    matchRate: number;
  };
  cutoffs: {
    total: number;
    mapped: number;
    unmapped: number;
    mapRate: number;
  };
}

export interface AnalyticsTrend {
  date: string;
  matchRate: number;
  totalRecords: number;
  type: 'college' | 'course' | 'cutoff';
}

export interface AnalyticsMetrics {
  currentSnapshot: AnalyticsSnapshot;
  history: AnalyticsSnapshot[];
  trends: {
    collegeMatchRate: AnalyticsTrend[];
    courseMatchRate: AnalyticsTrend[];
    cutoffMapRate: AnalyticsTrend[];
  };
  improvements: {
    collegeImprovement: number;
    courseImprovement: number;
    cutoffImprovement: number;
  };
  predictions: {
    estimatedTimeToComplete: number; // in hours
    recommendedActions: string[];
  };
}

class AnalyticsManager {
  private storageKey = 'staging-review-analytics';
  private maxHistoryDays = 30;

  async captureSnapshot(): Promise<AnalyticsSnapshot> {
    try {
      const [collegesRes, coursesRes, cutoffsRes] = await Promise.all([
        fetch('/api/staging/colleges'),
        fetch('/api/staging/courses'),
        fetch('/api/staging/cutoffs')
      ]);

      const colleges = await collegesRes.json();
      const courses = await coursesRes.json();
      const cutoffs = await cutoffsRes.json();

      const snapshot: AnalyticsSnapshot = {
        timestamp: Date.now(),
        colleges: {
          total: colleges.data.length,
          matched: colleges.data.filter((c: any) => c.unified_college_id).length,
          unmatched: colleges.data.filter((c: any) => !c.unified_college_id).length,
          matchRate: 0
        },
        courses: {
          total: courses.data.length,
          matched: courses.data.filter((c: any) => c.unified_course_id).length,
          unmatched: courses.data.filter((c: any) => !c.unified_course_id).length,
          matchRate: 0
        },
        cutoffs: {
          total: cutoffs.data.length,
          mapped: cutoffs.data.filter((c: any) => c.college_id && c.course_id).length,
          unmapped: cutoffs.data.filter((c: any) => !c.college_id || !c.course_id).length,
          mapRate: 0
        }
      };

      // Calculate rates
      snapshot.colleges.matchRate = snapshot.colleges.total > 0
        ? snapshot.colleges.matched / snapshot.colleges.total
        : 0;

      snapshot.courses.matchRate = snapshot.courses.total > 0
        ? snapshot.courses.matched / snapshot.courses.total
        : 0;

      snapshot.cutoffs.mapRate = snapshot.cutoffs.total > 0
        ? snapshot.cutoffs.mapped / snapshot.cutoffs.total
        : 0;

      // Save to history
      this.saveSnapshot(snapshot);

      return snapshot;
    } catch (error) {
      console.error('Failed to capture analytics snapshot:', error);
      throw error;
    }
  }

  private saveSnapshot(snapshot: AnalyticsSnapshot) {
    try {
      const history = this.getHistory();
      history.push(snapshot);

      // Remove old snapshots (older than maxHistoryDays)
      const cutoffDate = Date.now() - (this.maxHistoryDays * 24 * 60 * 60 * 1000);
      const filtered = history.filter(s => s.timestamp >= cutoffDate);

      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    }
  }

  getHistory(): AnalyticsSnapshot[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  async getMetrics(): Promise<AnalyticsMetrics> {
    const currentSnapshot = await this.captureSnapshot();
    const history = this.getHistory();

    // Calculate trends
    const collegeMatchRate: AnalyticsTrend[] = history.map(s => ({
      date: new Date(s.timestamp).toISOString().split('T')[0],
      matchRate: s.colleges.matchRate,
      totalRecords: s.colleges.total,
      type: 'college' as const
    }));

    const courseMatchRate: AnalyticsTrend[] = history.map(s => ({
      date: new Date(s.timestamp).toISOString().split('T')[0],
      matchRate: s.courses.matchRate,
      totalRecords: s.courses.total,
      type: 'course' as const
    }));

    const cutoffMapRate: AnalyticsTrend[] = history.map(s => ({
      date: new Date(s.timestamp).toISOString().split('T')[0],
      matchRate: s.cutoffs.mapRate,
      totalRecords: s.cutoffs.total,
      type: 'cutoff' as const
    }));

    // Calculate improvements (compare with first snapshot)
    const firstSnapshot = history.length > 0 ? history[0] : currentSnapshot;

    const improvements = {
      collegeImprovement: currentSnapshot.colleges.matchRate - firstSnapshot.colleges.matchRate,
      courseImprovement: currentSnapshot.courses.matchRate - firstSnapshot.courses.matchRate,
      cutoffImprovement: currentSnapshot.cutoffs.mapRate - firstSnapshot.cutoffs.mapRate
    };

    // Calculate predictions
    const predictions = this.calculatePredictions(history, currentSnapshot);

    return {
      currentSnapshot,
      history,
      trends: {
        collegeMatchRate,
        courseMatchRate,
        cutoffMapRate
      },
      improvements,
      predictions
    };
  }

  private calculatePredictions(
    history: AnalyticsSnapshot[],
    current: AnalyticsSnapshot
  ): { estimatedTimeToComplete: number; recommendedActions: string[] } {
    const recommendedActions: string[] = [];

    // Calculate average improvement rate
    if (history.length >= 2) {
      const first = history[0];
      const timeDiff = (current.timestamp - first.timestamp) / (1000 * 60 * 60); // hours
      const collegeImprovement = current.colleges.matchRate - first.colleges.matchRate;
      const courseImprovement = current.courses.matchRate - first.courses.matchRate;

      const avgImprovementRate = (collegeImprovement + courseImprovement) / 2;

      // Estimate time to reach 95% match rate
      const targetRate = 0.95;
      const remainingCollege = Math.max(0, targetRate - current.colleges.matchRate);
      const remainingCourse = Math.max(0, targetRate - current.courses.matchRate);
      const avgRemaining = (remainingCollege + remainingCourse) / 2;

      const estimatedTimeToComplete = avgImprovementRate > 0
        ? (avgRemaining / avgImprovementRate) * timeDiff
        : Infinity;

      // Generate recommendations
      if (current.colleges.matchRate < 0.8) {
        recommendedActions.push('Focus on college matching - below 80% match rate');
      }

      if (current.courses.matchRate < 0.8) {
        recommendedActions.push('Focus on course matching - below 80% match rate');
      }

      if (current.colleges.unmatched > 50) {
        recommendedActions.push('High number of unmatched colleges - consider bulk import of aliases');
      }

      if (current.courses.unmatched > 50) {
        recommendedActions.push('High number of unmatched courses - review master course list');
      }

      if (avgImprovementRate < 0) {
        recommendedActions.push('⚠️ Match rate is decreasing - review recent changes');
      }

      if (recommendedActions.length === 0) {
        recommendedActions.push('✅ Match rates are healthy - continue current workflow');
      }

      return {
        estimatedTimeToComplete: estimatedTimeToComplete === Infinity ? -1 : estimatedTimeToComplete,
        recommendedActions
      };
    }

    return {
      estimatedTimeToComplete: -1,
      recommendedActions: ['Not enough data yet - capture more snapshots to generate predictions']
    };
  }

  exportAnalytics(): string {
    const history = this.getHistory();

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      snapshotCount: history.length,
      snapshots: history
    }, null, 2);
  }

  clearHistory() {
    localStorage.removeItem(this.storageKey);
  }

  generateReport(): string {
    const history = this.getHistory();
    if (history.length === 0) {
      return '# Analytics Report\n\nNo data available yet. Capture a snapshot to begin tracking.';
    }

    const current = history[history.length - 1];
    const first = history[0];

    const lines: string[] = [];

    lines.push('# Staging Review Analytics Report\n');
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    lines.push(`Data Points: ${history.length} snapshots over ${Math.round((current.timestamp - first.timestamp) / (1000 * 60 * 60 * 24))} days\n`);

    lines.push('## Current Status\n');
    lines.push(`- **Colleges:** ${current.colleges.matched}/${current.colleges.total} matched (${(current.colleges.matchRate * 100).toFixed(1)}%)`);
    lines.push(`- **Courses:** ${current.courses.matched}/${current.courses.total} matched (${(current.courses.matchRate * 100).toFixed(1)}%)`);
    lines.push(`- **Cutoffs:** ${current.cutoffs.mapped}/${current.cutoffs.total} mapped (${(current.cutoffs.mapRate * 100).toFixed(1)}%)\n`);

    lines.push('## Improvements\n');
    const collegeImprovement = current.colleges.matchRate - first.colleges.matchRate;
    const courseImprovement = current.courses.matchRate - first.courses.matchRate;
    const cutoffImprovement = current.cutoffs.mapRate - first.cutoffs.mapRate;

    lines.push(`- **College Match Rate:** ${collegeImprovement >= 0 ? '+' : ''}${(collegeImprovement * 100).toFixed(1)}%`);
    lines.push(`- **Course Match Rate:** ${courseImprovement >= 0 ? '+' : ''}${(courseImprovement * 100).toFixed(1)}%`);
    lines.push(`- **Cutoff Map Rate:** ${cutoffImprovement >= 0 ? '+' : ''}${(cutoffImprovement * 100).toFixed(1)}%\n`);

    return lines.join('\n');
  }
}

export const analyticsManager = new AnalyticsManager();
