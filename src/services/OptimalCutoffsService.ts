/**
 * Optimal Cutoffs Service - Hybrid Architecture
 * Combines best of static + server-side filtering
 */

export class OptimalCutoffsService {
  private cache: Map<string, any[]> = new Map();

  // 1. Load priority rounds (fast - 100KB, 200-400ms)
  async loadPriorityRounds(stream: string) {
    const cached = this.cache.get(`${stream}_priority`);
    if (cached) return cached;

    const response = await fetch(`/data/cutoffs/${stream}_priority.json`);
    const data = await response.json();
    this.cache.set(`${stream}_priority`, data);
    return data;
  }

  // 2. Load additional rounds progressively
  async loadAdditionalRound(stream: string, round: number) {
    const cacheKey = `${stream}_round_${round}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(`/data/cutoffs/${stream}_round_${round}.json`);
    const data = await response.json();
    this.cache.set(cacheKey, data);
    return data;
  }

  // 3. Client-side filtering (fast for in-memory data)
  filterClientSide(data: any[], filters: any) {
    return data.filter(record => {
      if (filters.college && !record.college_name.includes(filters.college)) return false;
      if (filters.course && !record.course_name.includes(filters.course)) return false;
      if (filters.minRank && record.closing_rank > filters.minRank) return false;
      if (filters.maxRank && record.opening_rank < filters.maxRank) return false;
      return true;
    });
  }

  // 4. For heavy queries, use server-side filtering via Next.js API route
  async filterServerSide(stream: string, filters: any) {
    const response = await fetch(`/api/cutoffs/filter`, {
      method: 'POST',
      body: JSON.stringify({ stream, filters })
    });
    return response.json();
  }
}

export const optimalCutoffsService = new OptimalCutoffsService();
