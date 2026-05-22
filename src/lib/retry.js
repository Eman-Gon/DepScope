async function withRetry(fn, retries = 2, delayMs = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Retry ${i + 1}/${retries}: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
}

module.exports = { withRetry };
