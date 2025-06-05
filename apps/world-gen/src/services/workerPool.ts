// Worker pool for chunk generation
import { Worker } from 'worker_threads';
import path from 'path';

const WORKER_PATH = path.resolve(__dirname, './chunkWorker.js');
const MAX_WORKERS = 4;
const queue: any[] = [];
let active = 0;

export function runChunkWorker(
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  seed: string
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const task = { chunkX, chunkY, chunkSize, seed, resolve, reject };
    queue.push(task);
    processQueue();
  });
}

function processQueue() {
  if (active >= MAX_WORKERS || queue.length === 0) return;
  const { chunkX, chunkY, chunkSize, seed, resolve, reject } = queue.shift();
  active++;
  const worker = new Worker(WORKER_PATH, {
    workerData: { chunkX, chunkY, chunkSize, seed },
  });
  worker.on('message', (result) => {
    active--;
    resolve(result);
    processQueue();
  });
  worker.on('error', (err) => {
    active--;
    reject(err);
    processQueue();
  });
  worker.on('exit', () => {
    active--;
    processQueue();
  });
}
