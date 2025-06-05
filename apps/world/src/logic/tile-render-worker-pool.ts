import { Worker } from 'worker_threads';
import { RenderMode } from './map-renderer';

export interface TileRenderTask {
  worldX: number;
  worldY: number;
  startX: number;
  startY: number;
  endY: number;
  pixelSize: number;
  renderMode: RenderMode;
}

export interface TileRenderResult {
  worldX: number;
  worldY: number;
  pixelX: number;
  pixelY: number;
  color: string;
  biomeName: string;
  cacheSource: 'cache' | 'database' | 'generated';
  success: boolean;
  error?: string;
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
}

/**
 * Worker pool for parallel tile rendering using worker threads
 */
export class TileRenderWorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private busyWorkers: Set<Worker> = new Set();
  private taskQueue: Array<{
    task: TileRenderTask;
    resolve: (result: TileRenderResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private maxWorkers: number;
  private workerTaskCounts: Map<Worker, number> = new Map();

  constructor(options: WorkerPoolOptions = {}) {
    this.maxWorkers =
      options.maxWorkers ??
      Math.max(2, Math.min(8, require('os').cpus().length));

    console.log(
      `🔧 Initializing worker pool with ${this.maxWorkers} workers (persistent until shutdown)`
    );
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    const workerPromises = [];

    for (let i = 0; i < this.maxWorkers; i++) {
      workerPromises.push(this.createWorker());
    }

    await Promise.all(workerPromises);
    console.log(
      `✅ Worker pool initialized with ${this.workers.length} workers`
    );
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<Worker> {
    const worker = new Worker(require.resolve('./tile-render-worker.js'), {
      // Pass any initialization data if needed
      workerData: {
        // Could pass database connection info, config, etc.
      },
    });

    // Set up error handling
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.handleWorkerError(worker, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`Worker exited with code ${code}`);
      }
      this.removeWorker(worker);
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);
    this.workerTaskCounts.set(worker, 0);

    return worker;
  }

  /**
   * Process a tile rendering task
   */
  async processTask(task: TileRenderTask): Promise<TileRenderResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process tasks from the queue
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const queueItem = this.taskQueue.shift();
      const worker = this.availableWorkers.shift();

      if (!queueItem || !worker) {
        break;
      }

      const { task, resolve, reject } = queueItem;

      this.busyWorkers.add(worker);

      // Set up one-time message listener for this task
      const onMessage = (result: TileRenderResult) => {
        worker.off('message', onMessage);
        worker.off('error', onError);

        this.busyWorkers.delete(worker);

        // Increment task count but don't recycle workers during rendering
        const taskCount = this.workerTaskCounts.get(worker) ?? 0;
        this.workerTaskCounts.set(worker, taskCount + 1);

        // Always return worker to available pool (no recycling)
        this.availableWorkers.push(worker);
        this.processQueue(); // Process next task

        resolve(result);
      };

      const onError = (error: Error) => {
        worker.off('message', onMessage);
        worker.off('error', onError);

        this.busyWorkers.delete(worker);
        this.handleWorkerError(worker, error);
        reject(error);
      };

      worker.once('message', onMessage);
      worker.once('error', onError);

      // Send task to worker
      worker.postMessage(task);
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(worker: Worker, error: Error): void {
    console.error('Worker error, attempting to recreate:', error);
    this.removeWorker(worker);

    // Create a replacement worker
    this.createWorker().catch((err) => {
      console.error('Failed to create replacement worker:', err);
    });
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(worker: Worker): void {
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex >= 0) {
      this.workers.splice(workerIndex, 1);
    }

    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex >= 0) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    this.busyWorkers.delete(worker);
    this.workerTaskCounts.delete(worker);

    worker.terminate().catch((err) => {
      console.warn('Error terminating worker:', err);
    });
  }

  /**
   * Process multiple tasks in parallel
   */
  async processTasks(tasks: TileRenderTask[]): Promise<TileRenderResult[]> {
    const promises = tasks.map((task) => this.processTask(task));
    return Promise.all(promises);
  }

  /**
   * Process multiple tasks with progress monitoring
   */
  async processTasksWithProgress(
    tasks: TileRenderTask[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<TileRenderResult[]> {
    if (!onProgress) {
      return this.processTasks(tasks);
    }

    const results: TileRenderResult[] = [];
    let completedCount = 0;
    const total = tasks.length;

    // Create promises with progress tracking
    const promises = tasks.map((task) =>
      this.processTask(task).then((result) => {
        results[results.length] = result;
        completedCount++;
        onProgress(completedCount, total);
        return result;
      })
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get worker pool statistics
   */
  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    totalTasksProcessed: number;
  } {
    const totalTasksProcessed = Array.from(
      this.workerTaskCounts.values()
    ).reduce((sum, count) => sum + count, 0);

    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length,
      totalTasksProcessed,
    };
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down worker pool...');

    const terminationPromises = this.workers.map((worker) =>
      worker
        .terminate()
        .catch((err) => console.warn('Error terminating worker:', err))
    );

    await Promise.all(terminationPromises);

    this.workers = [];
    this.availableWorkers = [];
    this.busyWorkers.clear();
    this.taskQueue = [];
    this.workerTaskCounts.clear();

    console.log('✅ Worker pool shutdown complete');
  }
}
