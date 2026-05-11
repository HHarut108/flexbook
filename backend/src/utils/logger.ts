interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
}

const noop = () => {};
const noopLogger: Logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
};

let current: Logger = noopLogger;

export function setSharedLogger(l: Logger): void {
  current = l;
}

export function log(): Logger {
  return current;
}
