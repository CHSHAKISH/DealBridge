import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/index.js';
import { DealSyncService } from '../services/sync/deal-sync.service.js';

// Dynamic Redis connection configuration supporting local and cloud Redis (Upstash, Render, etc.)
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
      };
    } catch {
      // Fallback if URL parsing fails
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

const connection = getRedisConnection();

export const dealSyncQueue = new Queue('deal-sync-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const milestoneQueue = new Queue('milestone-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Worker that processes incoming CRM Closed Won deals asynchronously
 */
export const dealWorker = new Worker(
  'deal-sync-queue',
  async (job: Job) => {
    console.log(`[DealWorker] Processing job ${job.id} for deal: ${job.data.hubspotDealId}...`);
    return await DealSyncService.syncClosedWonDeal(job.data);
  },
  {
    connection,
    concurrency: 3,
  }
);

dealWorker.on('completed', (job: Job) => {
  console.log(`[DealWorker] Job ${job.id} completed successfully!`);
});

dealWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[DealWorker] Job ${job?.id} failed with error:`, err.message);
});

