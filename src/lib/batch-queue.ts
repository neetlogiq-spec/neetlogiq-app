// Batch Processing Queue for handling multiple file imports

export interface BatchJob {
  id: string;
  name: string;
  type: 'import' | 'export' | 'match' | 'validate';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalItems: number;
  processedItems: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
  metadata?: Record<string, any>;
}

export interface BatchQueueOptions {
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

class BatchProcessingQueue {
  private jobs: Map<string, BatchJob> = new Map();
  private processing: Set<string> = new Set();
  private storageKey = 'staging-review-batch-queue';
  private options: BatchQueueOptions = {
    maxConcurrent: 3,
    retryAttempts: 3,
    retryDelay: 2000
  };

  constructor() {
    this.loadFromStorage();
  }

  // Create a new batch job
  createJob(
    name: string,
    type: BatchJob['type'],
    totalItems: number,
    metadata?: Record<string, any>
  ): BatchJob {
    const job: BatchJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      status: 'pending',
      progress: 0,
      totalItems,
      processedItems: 0,
      createdAt: Date.now(),
      metadata
    };

    this.jobs.set(job.id, job);
    this.saveToStorage();

    return job;
  }

  // Get job by ID
  getJob(jobId: string): BatchJob | null {
    return this.jobs.get(jobId) || null;
  }

  // Get all jobs
  getAllJobs(): BatchJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // Get jobs by status
  getJobsByStatus(status: BatchJob['status']): BatchJob[] {
    return this.getAllJobs().filter(job => job.status === status);
  }

  // Update job status
  updateJobStatus(
    jobId: string,
    status: BatchJob['status'],
    error?: string,
    result?: any
  ): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.status = status;

    if (status === 'processing' && !job.startedAt) {
      job.startedAt = Date.now();
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      job.completedAt = Date.now();
      this.processing.delete(jobId);
    }

    if (error) {
      job.error = error;
    }

    if (result) {
      job.result = result;
    }

    this.jobs.set(jobId, job);
    this.saveToStorage();

    // Process next job if space available
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      this.processNextJob();
    }

    return true;
  }

  // Update job progress
  updateJobProgress(jobId: string, processedItems: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.processedItems = processedItems;
    job.progress = job.totalItems > 0
      ? Math.round((processedItems / job.totalItems) * 100)
      : 0;

    this.jobs.set(jobId, job);
    this.saveToStorage();

    return true;
  }

  // Start processing a job
  async startJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') return false;

    // Check if we're at max concurrent jobs
    if (this.processing.size >= this.options.maxConcurrent) {
      return false;
    }

    this.processing.add(jobId);
    this.updateJobStatus(jobId, 'processing');

    try {
      // Process based on job type
      switch (job.type) {
        case 'import':
          await this.processImportJob(job);
          break;
        case 'export':
          await this.processExportJob(job);
          break;
        case 'match':
          await this.processMatchJob(job);
          break;
        case 'validate':
          await this.processValidateJob(job);
          break;
      }

      this.updateJobStatus(jobId, 'completed');
      return true;
    } catch (error) {
      this.updateJobStatus(jobId, 'failed', String(error));
      return false;
    }
  }

  // Process next pending job
  private async processNextJob() {
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const pendingJobs = this.getJobsByStatus('pending');
    if (pendingJobs.length === 0) {
      return;
    }

    const nextJob = pendingJobs[0];
    await this.startJob(nextJob.id);
  }

  // Cancel a job
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending' || job.status === 'processing') {
      this.updateJobStatus(jobId, 'cancelled');
      return true;
    }

    return false;
  }

  // Delete a job
  deleteJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Can only delete completed, failed, or cancelled jobs
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      this.jobs.delete(jobId);
      this.saveToStorage();
      return true;
    }

    return false;
  }

  // Clear all completed jobs
  clearCompletedJobs(): number {
    const completed = this.getJobsByStatus('completed');
    completed.forEach(job => this.jobs.delete(job.id));
    this.saveToStorage();
    return completed.length;
  }

  // Job processing methods (to be implemented based on actual needs)
  private async processImportJob(job: BatchJob): Promise<void> {
    const files = job.metadata?.files || [];

    for (let i = 0; i < files.length; i++) {
      // Simulate file import
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update progress
      this.updateJobProgress(job.id, i + 1);

      // Check if job was cancelled
      const currentJob = this.jobs.get(job.id);
      if (currentJob?.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }
    }
  }

  private async processExportJob(job: BatchJob): Promise<void> {
    // Simulate export
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.updateJobProgress(job.id, job.totalItems);
  }

  private async processMatchJob(job: BatchJob): Promise<void> {
    // Simulate matching
    for (let i = 0; i < job.totalItems; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.updateJobProgress(job.id, i + 1);

      const currentJob = this.jobs.get(job.id);
      if (currentJob?.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }
    }
  }

  private async processValidateJob(job: BatchJob): Promise<void> {
    // Simulate validation
    for (let i = 0; i < job.totalItems; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      this.updateJobProgress(job.id, i + 1);

      const currentJob = this.jobs.get(job.id);
      if (currentJob?.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }
    }
  }

  // Statistics
  getStatistics() {
    const allJobs = this.getAllJobs();

    return {
      total: allJobs.length,
      pending: this.getJobsByStatus('pending').length,
      processing: this.getJobsByStatus('processing').length,
      completed: this.getJobsByStatus('completed').length,
      failed: this.getJobsByStatus('failed').length,
      cancelled: this.getJobsByStatus('cancelled').length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      successRate: this.calculateSuccessRate()
    };
  }

  private calculateAverageProcessingTime(): number {
    const completedJobs = this.getJobsByStatus('completed');

    if (completedJobs.length === 0) return 0;

    const totalTime = completedJobs.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        return sum + (job.completedAt - job.startedAt);
      }
      return sum;
    }, 0);

    return totalTime / completedJobs.length;
  }

  private calculateSuccessRate(): number {
    const completedJobs = this.getJobsByStatus('completed');
    const failedJobs = this.getJobsByStatus('failed');
    const total = completedJobs.length + failedJobs.length;

    return total > 0 ? (completedJobs.length / total) * 100 : 0;
  }

  // Storage
  private saveToStorage() {
    try {
      const data = {
        jobs: Array.from(this.jobs.entries()),
        processing: Array.from(this.processing)
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save batch queue:', error);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.jobs = new Map(parsed.jobs || []);
        // Don't restore processing state - jobs should restart
        this.processing = new Set();

        // Reset any jobs that were processing
        this.jobs.forEach(job => {
          if (job.status === 'processing') {
            job.status = 'pending';
            this.jobs.set(job.id, job);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load batch queue:', error);
    }
  }

  clearAll() {
    this.jobs.clear();
    this.processing.clear();
    localStorage.removeItem(this.storageKey);
  }
}

export const batchQueue = new BatchProcessingQueue();
