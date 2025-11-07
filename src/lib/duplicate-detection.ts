// Duplicate Detection System for identifying potential duplicates

export interface DuplicateGroup {
  id: string;
  items: DuplicateItem[];
  similarityScore: number;
  type: 'college' | 'course' | 'cutoff';
  reason: string;
}

export interface DuplicateItem {
  id: string;
  name: string;
  data: Record<string, any>;
}

export interface DuplicateDetectionConfig {
  nameThreshold: number; // 0-1, how similar names must be
  checkColleges: boolean;
  checkCourses: boolean;
  checkCutoffs: boolean;
  fuzzyMatch: boolean;
}

class DuplicateDetector {
  private defaultConfig: DuplicateDetectionConfig = {
    nameThreshold: 0.85,
    checkColleges: true,
    checkCourses: true,
    checkCutoffs: true,
    fuzzyMatch: true
  };

  // Levenshtein distance for string similarity
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  // Calculate similarity score (0-1)
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
  }

  // Normalize text for comparison
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Detect duplicate colleges
  detectDuplicateColleges(
    colleges: Array<{ id: string; name: string; [key: string]: any }>,
    threshold: number = 0.85
  ): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < colleges.length; i++) {
      if (processed.has(colleges[i].id)) continue;

      const similar: DuplicateItem[] = [{
        id: colleges[i].id,
        name: colleges[i].name,
        data: colleges[i]
      }];

      for (let j = i + 1; j < colleges.length; j++) {
        if (processed.has(colleges[j].id)) continue;

        const similarity = this.calculateSimilarity(
          this.normalizeText(colleges[i].name),
          this.normalizeText(colleges[j].name)
        );

        if (similarity >= threshold) {
          similar.push({
            id: colleges[j].id,
            name: colleges[j].name,
            data: colleges[j]
          });
          processed.add(colleges[j].id);
        }
      }

      if (similar.length > 1) {
        groups.push({
          id: `college-dup-${Date.now()}-${i}`,
          items: similar,
          similarityScore: this.calculateGroupSimilarity(similar),
          type: 'college',
          reason: 'Similar college names detected'
        });
        processed.add(colleges[i].id);
      }
    }

    return groups;
  }

  // Detect duplicate courses
  detectDuplicateCourses(
    courses: Array<{ id: string; name: string; [key: string]: any }>,
    threshold: number = 0.85
  ): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < courses.length; i++) {
      if (processed.has(courses[i].id)) continue;

      const similar: DuplicateItem[] = [{
        id: courses[i].id,
        name: courses[i].name,
        data: courses[i]
      }];

      for (let j = i + 1; j < courses.length; j++) {
        if (processed.has(courses[j].id)) continue;

        const similarity = this.calculateSimilarity(
          this.normalizeText(courses[i].name),
          this.normalizeText(courses[j].name)
        );

        if (similarity >= threshold) {
          similar.push({
            id: courses[j].id,
            name: courses[j].name,
            data: courses[j]
          });
          processed.add(courses[j].id);
        }
      }

      if (similar.length > 1) {
        groups.push({
          id: `course-dup-${Date.now()}-${i}`,
          items: similar,
          similarityScore: this.calculateGroupSimilarity(similar),
          type: 'course',
          reason: 'Similar course names detected'
        });
        processed.add(courses[i].id);
      }
    }

    return groups;
  }

  // Detect exact duplicate cutoffs
  detectDuplicateCutoffs(
    cutoffs: Array<{
      id: string;
      collegeId: string;
      courseId: string;
      year: number;
      round: number;
      quota: string;
      category: string;
      [key: string]: any;
    }>
  ): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const map = new Map<string, DuplicateItem[]>();

    cutoffs.forEach(cutoff => {
      // Create a unique key for this cutoff combination
      const key = `${cutoff.collegeId}|${cutoff.courseId}|${cutoff.year}|${cutoff.round}|${cutoff.quota}|${cutoff.category}`;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push({
        id: cutoff.id,
        name: `${cutoff.year}-R${cutoff.round}-${cutoff.quota}-${cutoff.category}`,
        data: cutoff
      });
    });

    // Find groups with duplicates
    map.forEach((items, key) => {
      if (items.length > 1) {
        groups.push({
          id: `cutoff-dup-${Date.now()}-${key}`,
          items,
          similarityScore: 1.0, // Exact match
          type: 'cutoff',
          reason: 'Exact duplicate cutoff record (same college, course, year, round, quota, category)'
        });
      }
    });

    return groups;
  }

  // Calculate average similarity for a group
  private calculateGroupSimilarity(items: DuplicateItem[]): number {
    if (items.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        totalSimilarity += this.calculateSimilarity(
          this.normalizeText(items[i].name),
          this.normalizeText(items[j].name)
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  }

  // Run full duplicate detection
  async detectAllDuplicates(
    config: Partial<DuplicateDetectionConfig> = {}
  ): Promise<{
    colleges: DuplicateGroup[];
    courses: DuplicateGroup[];
    cutoffs: DuplicateGroup[];
    summary: {
      totalGroups: number;
      totalDuplicates: number;
      byType: Record<string, number>;
    };
  }> {
    const fullConfig = { ...this.defaultConfig, ...config };
    const result = {
      colleges: [] as DuplicateGroup[],
      courses: [] as DuplicateGroup[],
      cutoffs: [] as DuplicateGroup[],
      summary: {
        totalGroups: 0,
        totalDuplicates: 0,
        byType: {} as Record<string, number>
      }
    };

    try {
      // Fetch data from API
      if (fullConfig.checkColleges) {
        const response = await fetch('/api/staging/colleges');
        if (response.ok) {
          const data = await response.json();
          result.colleges = this.detectDuplicateColleges(
            data.data.map((c: any) => ({
              id: c.id,
              name: c.staging_college_name,
              ...c
            })),
            fullConfig.nameThreshold
          );
        }
      }

      if (fullConfig.checkCourses) {
        const response = await fetch('/api/staging/courses');
        if (response.ok) {
          const data = await response.json();
          result.courses = this.detectDuplicateCourses(
            data.data.map((c: any) => ({
              id: c.id,
              name: c.staging_course_name,
              ...c
            })),
            fullConfig.nameThreshold
          );
        }
      }

      if (fullConfig.checkCutoffs) {
        const response = await fetch('/api/staging/cutoffs');
        if (response.ok) {
          const data = await response.json();
          result.cutoffs = this.detectDuplicateCutoffs(data.data);
        }
      }

      // Calculate summary
      result.summary.totalGroups =
        result.colleges.length + result.courses.length + result.cutoffs.length;

      result.summary.totalDuplicates =
        result.colleges.reduce((sum, g) => sum + g.items.length, 0) +
        result.courses.reduce((sum, g) => sum + g.items.length, 0) +
        result.cutoffs.reduce((sum, g) => sum + g.items.length, 0);

      result.summary.byType = {
        college: result.colleges.reduce((sum, g) => sum + g.items.length, 0),
        course: result.courses.reduce((sum, g) => sum + g.items.length, 0),
        cutoff: result.cutoffs.reduce((sum, g) => sum + g.items.length, 0)
      };
    } catch (error) {
      console.error('Failed to detect duplicates:', error);
    }

    return result;
  }

  // Export duplicate report
  exportDuplicateReport(groups: DuplicateGroup[]): string {
    const lines: string[] = [];

    lines.push('# Duplicate Detection Report\n');
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    lines.push(`Total Groups: ${groups.length}\n`);

    groups.forEach((group, index) => {
      lines.push(`\n## Group ${index + 1}: ${group.type.toUpperCase()}`);
      lines.push(`**Reason:** ${group.reason}`);
      lines.push(`**Similarity:** ${(group.similarityScore * 100).toFixed(1)}%`);
      lines.push(`**Items:**`);

      group.items.forEach((item, i) => {
        lines.push(`${i + 1}. ${item.name} (ID: ${item.id})`);
      });
    });

    return lines.join('\n');
  }
}

export const duplicateDetector = new DuplicateDetector();
