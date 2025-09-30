const isDev =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

export const debugLog = (...args: unknown[]): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export default debugLog;
