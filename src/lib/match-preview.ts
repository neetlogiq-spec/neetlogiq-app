// Match Preview - Shows what cutoffs will be affected by a match

export interface MatchPreviewResult {
  collegeId?: string;
  collegeName?: string;
  courseId?: string;
  courseName?: string;
  affectedCutoffs: CutoffPreview[];
  totalRecords: number;
  years: Set<number>;
  rounds: Set<number>;
  categories: Set<string>;
  quotas: Set<string>;
}

export interface CutoffPreview {
  id: string;
  year: number;
  round: number;
  quota: string;
  category: string;
  openingRank: number;
  closingRank: number;
  sourceFile: string;
}

class MatchPreviewManager {
  async previewCollegeMatch(
    stagingCollegeId: string,
    unifiedCollegeId: string
  ): Promise<MatchPreviewResult> {
    try {
      const response = await fetch(
        `/api/staging/preview/college/${stagingCollegeId}/${unifiedCollegeId}`
      );

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processPreviewData(data);
    } catch (error) {
      console.error('Failed to fetch college match preview:', error);
      throw error;
    }
  }

  async previewCourseMatch(
    stagingCourseId: string,
    unifiedCourseId: string
  ): Promise<MatchPreviewResult> {
    try {
      const response = await fetch(
        `/api/staging/preview/course/${stagingCourseId}/${unifiedCourseId}`
      );

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processPreviewData(data);
    } catch (error) {
      console.error('Failed to fetch course match preview:', error);
      throw error;
    }
  }

  async previewCombinedMatch(
    stagingCollegeId: string,
    unifiedCollegeId: string,
    stagingCourseId: string,
    unifiedCourseId: string
  ): Promise<MatchPreviewResult> {
    try {
      const response = await fetch('/api/staging/preview/combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingCollegeId,
          unifiedCollegeId,
          stagingCourseId,
          unifiedCourseId
        })
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processPreviewData(data);
    } catch (error) {
      console.error('Failed to fetch combined match preview:', error);
      throw error;
    }
  }

  private processPreviewData(data: any): MatchPreviewResult {
    const cutoffs: CutoffPreview[] = data.cutoffs || [];
    const years = new Set<number>();
    const rounds = new Set<number>();
    const categories = new Set<string>();
    const quotas = new Set<string>();

    cutoffs.forEach(cutoff => {
      years.add(cutoff.year);
      rounds.add(cutoff.round);
      categories.add(cutoff.category);
      quotas.add(cutoff.quota);
    });

    return {
      collegeId: data.collegeId,
      collegeName: data.collegeName,
      courseId: data.courseId,
      courseName: data.courseName,
      affectedCutoffs: cutoffs,
      totalRecords: cutoffs.length,
      years,
      rounds,
      categories,
      quotas
    };
  }

  generatePreviewSummary(preview: MatchPreviewResult): string {
    const lines: string[] = [];

    lines.push('# Match Preview Summary\n');

    if (preview.collegeName) {
      lines.push(`**College:** ${preview.collegeName} (${preview.collegeId})`);
    }

    if (preview.courseName) {
      lines.push(`**Course:** ${preview.courseName} (${preview.courseId})`);
    }

    lines.push(`\n**Total Affected Records:** ${preview.totalRecords}\n`);

    lines.push('## Breakdown\n');
    lines.push(`- **Years:** ${Array.from(preview.years).sort().join(', ')}`);
    lines.push(`- **Rounds:** ${Array.from(preview.rounds).sort().join(', ')}`);
    lines.push(`- **Categories:** ${Array.from(preview.categories).sort().join(', ')}`);
    lines.push(`- **Quotas:** ${Array.from(preview.quotas).sort().join(', ')}`);

    if (preview.affectedCutoffs.length > 0) {
      lines.push('\n## Sample Cutoffs (First 10)\n');
      lines.push('| Year | Round | Quota | Category | Opening | Closing |');
      lines.push('|------|-------|-------|----------|---------|---------|');

      preview.affectedCutoffs.slice(0, 10).forEach(cutoff => {
        lines.push(
          `| ${cutoff.year} | ${cutoff.round} | ${cutoff.quota} | ${cutoff.category} | ${cutoff.openingRank} | ${cutoff.closingRank} |`
        );
      });

      if (preview.affectedCutoffs.length > 10) {
        lines.push(`\n*...and ${preview.affectedCutoffs.length - 10} more records*`);
      }
    }

    return lines.join('\n');
  }

  formatPreviewForDisplay(preview: MatchPreviewResult): {
    title: string;
    summary: string;
    details: string[];
    warnings: string[];
  } {
    const title = preview.collegeName || preview.courseName || 'Match Preview';

    const summary = `This match will affect ${preview.totalRecords} cutoff record${
      preview.totalRecords !== 1 ? 's' : ''
    } across ${preview.years.size} year${preview.years.size !== 1 ? 's' : ''}.`;

    const details: string[] = [
      `Years: ${Array.from(preview.years).sort().join(', ')}`,
      `Rounds: ${Array.from(preview.rounds).sort().join(', ')}`,
      `Categories: ${Array.from(preview.categories).sort().join(', ')}`,
      `Quotas: ${Array.from(preview.quotas).sort().join(', ')}`
    ];

    const warnings: string[] = [];

    // Add warnings based on data
    if (preview.totalRecords === 0) {
      warnings.push('⚠️ No cutoff records will be affected by this match');
    }

    if (preview.totalRecords > 1000) {
      warnings.push('⚠️ This match affects a large number of records (>1000)');
    }

    if (preview.years.size > 5) {
      warnings.push('⚠️ This match spans many years - verify data accuracy');
    }

    return {
      title,
      summary,
      details,
      warnings
    };
  }

  exportPreviewToCSV(preview: MatchPreviewResult): string {
    const headers = ['Year', 'Round', 'Quota', 'Category', 'Opening Rank', 'Closing Rank', 'Source File'];
    const rows = preview.affectedCutoffs.map(cutoff => [
      cutoff.year,
      cutoff.round,
      cutoff.quota,
      cutoff.category,
      cutoff.openingRank,
      cutoff.closingRank,
      cutoff.sourceFile
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }
}

export const matchPreviewManager = new MatchPreviewManager();
