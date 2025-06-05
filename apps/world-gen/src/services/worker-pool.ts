import { Worker } from 'worker_threads';
import { logger } from '../utils/logger';
import path from 'path';

export interface WorkerTask {
  id: string;
  type: 'generateChunk';
  data: {
    chunkX: number;
    chunkY: number;
    seed: number;
  };
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (value: WorkerResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private activeTasks: Map<
    string,
    { resolve: (value: WorkerResult) => void; reject: (error: Error) => void }
  > = new Map();

  constructor(private poolSize = 4) {}

  async initialize(): Promise<void> {
    logger.info(`Initializing worker pool with ${this.poolSize} workers`);

    for (let i = 0; i < this.poolSize; i++) {
      try {
        // Always use the compiled JavaScript worker file
        const workerPath = path.join(__dirname, '../workers/chunk-worker.js');

        const worker = new Worker(workerPath);

        worker.on('message', (result: WorkerResult) => {
          this.handleWorkerMessage(worker, result);
        });

        worker.on('error', (error) => {
          logger.error(`Worker ${i} error:`, error);
          this.handleWorkerError(worker, error);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.error(`Worker ${i} stopped with exit code ${code}`);
          }
        });

        this.workers.push(worker);
        this.availableWorkers.push(worker);
      } catch (error) {
        logger.error(`Failed to create worker ${i}:`, error);
      }
    }

    logger.info(`Worker pool initialized with ${this.workers.length} workers`);
  }

  async executeTask(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const queueItem = this.taskQueue.shift();
    const worker = this.availableWorkers.shift();

    if (!queueItem || !worker) {
      return;
    }

    const { task, resolve, reject } = queueItem;
    this.activeTasks.set(task.id, { resolve, reject });

    try {
      worker.postMessage(task);
    } catch (error) {
      logger.error('Failed to send task to worker:', error);
      this.activeTasks.delete(task.id);
      this.availableWorkers.push(worker);
      reject(error as Error);
      this.processQueue();
    }
  }

  private handleWorkerMessage(worker: Worker, result: WorkerResult): void {
    const taskHandler = this.activeTasks.get(result.taskId);
    if (!taskHandler) {
      logger.warn(`Received result for unknown task: ${result.taskId}`);
      return;
    }

    this.activeTasks.delete(result.taskId);
    this.availableWorkers.push(worker);

    if (result.success) {
      taskHandler.resolve(result);
    } else {
      taskHandler.reject(new Error(result.error || 'Unknown worker error'));
    }

    // Process next task in queue
    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: Error): void {
    // Find and reject any active tasks for this worker
    for (const [taskId, handler] of this.activeTasks.entries()) {
      // This is a simple approach - in reality, you'd want to track which worker is handling which task
      handler.reject(error);
      this.activeTasks.delete(taskId);
    }

    // Remove worker from available pool
    const index = this.availableWorkers.indexOf(worker);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down worker pool');

    const shutdownPromises = this.workers.map((worker) => {
      return new Promise<void>((resolve) => {
        worker
          .terminate()
          .then(() => resolve())
          .catch(() => resolve());
      });
    });

    await Promise.all(shutdownPromises);

    this.workers = [];
    this.availableWorkers = [];
    this.activeTasks.clear();
    this.taskQueue = [];

    logger.info('Worker pool shut down');
  }

  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
    };
  }
}
