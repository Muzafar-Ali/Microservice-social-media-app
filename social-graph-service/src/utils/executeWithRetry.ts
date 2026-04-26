import logger from './logger.js';

const executeWithRetry = async (taskName: string, task: () => Promise<void>, maxRetries = 10, delayMs = 5000) => {
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

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export default executeWithRetry;
