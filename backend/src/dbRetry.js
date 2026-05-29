const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_CODES = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EPIPE",
  "EAI_AGAIN",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "53300" // too_many_connections
]);

export function isRetryableDbError(err) {
  if (!err) return false;
  if (RETRYABLE_CODES.has(err.code)) return true;
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    return err.errors.some((e) => isRetryableDbError(e));
  }
  const message = String(err.message || "").toLowerCase();
  return message.includes("timeout") || message.includes("connection terminated");
}

export function getDbRetryOptions(overrides = {}) {
  return {
    maxAttempts: Math.max(
      1,
      Number(process.env.DB_RETRY_MAX_ATTEMPTS || overrides.maxAttempts || 5) || 5
    ),
    initialDelayMs: Math.max(
      100,
      Number(process.env.DB_RETRY_INITIAL_DELAY_MS || overrides.initialDelayMs || 500) || 500
    ),
    maxDelayMs: Math.max(
      500,
      Number(process.env.DB_RETRY_MAX_DELAY_MS || overrides.maxDelayMs || 8000) || 8000
    )
  };
}

export function getDbConnectionTimeoutMs() {
  return Math.max(
    5000,
    Number(process.env.DB_CONNECTION_TIMEOUT_MS || 30000) || 30000
  );
}

export async function withDbRetry(fn, overrides = {}) {
  const { maxAttempts, initialDelayMs, maxDelayMs } = getDbRetryOptions(overrides);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt >= maxAttempts;
      if (!isRetryableDbError(err) || isLast) {
        throw err;
      }
      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      // eslint-disable-next-line no-console
      console.warn(
        `[db-retry] Försök ${attempt}/${maxAttempts} misslyckades (${err.code || err.message}), försöker igen om ${delay} ms`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

export function wrapPoolWithRetry(pool, overrides = {}) {
  const originalQuery = pool.query.bind(pool);
  pool.query = (...args) => withDbRetry(() => originalQuery(...args), overrides);
  return pool;
}

export async function waitForDatabase(pool, overrides = {}) {
  const startupAttempts = Math.max(
    1,
    Number(process.env.DB_STARTUP_MAX_ATTEMPTS || overrides.maxAttempts || 20) || 20
  );
  const initialDelayMs = Math.max(
    500,
    Number(process.env.DB_STARTUP_INITIAL_DELAY_MS || overrides.initialDelayMs || 2000) || 2000
  );

  // eslint-disable-next-line no-console
  console.log(
    `[db-retry] Väntar på databas (upp till ${startupAttempts} försök, timeout ${getDbConnectionTimeoutMs()} ms per anslutning)`
  );

  await withDbRetry(() => pool.query("SELECT 1 AS ok"), {
    maxAttempts: startupAttempts,
    initialDelayMs,
    maxDelayMs: Math.max(
      10000,
      Number(process.env.DB_STARTUP_MAX_DELAY_MS || overrides.maxDelayMs || 15000) || 15000
    )
  });

  // eslint-disable-next-line no-console
  console.log("[db-retry] Databas svarar");
}
