import logger from './logger.js';

const sleep = (delayMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

const executeWithRetry = async (
  taskName: string,
  task: () => Promise<void>,
  maxRetries = 10,
  delayMs = 5000,
): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await task();

      logger.info(`✅ ${taskName} succeeded`);
      return;
    } catch (error) {
      logger.error({ error, attempt, maxRetries }, `❌ ${taskName} failed`);

      if (attempt === maxRetries) {
        throw error;
      }

      const nextDelayMs = delayMs * attempt;
      await sleep(nextDelayMs);
    }
  }
};

export default executeWithRetry;
