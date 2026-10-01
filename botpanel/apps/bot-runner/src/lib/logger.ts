export type Logger = {
  info: (msg: string, extra?: unknown) => void;
  warn: (msg: string, extra?: unknown) => void;
  error: (msg: string, extra?: unknown) => void;
  child: (scope: string) => Logger;
};

export function createLogger(scope: string): Logger {
  const fmt = (level: string, msg: string) => `${new Date().toISOString()} ${level} [${scope}] ${msg}`;
  return {
    info: (msg, extra) => console.log(fmt("INFO ", msg), ...(extra === undefined ? [] : [extra])),
    warn: (msg, extra) => console.warn(fmt("WARN ", msg), ...(extra === undefined ? [] : [extra])),
    error: (msg, extra) => console.error(fmt("ERROR", msg), ...(extra === undefined ? [] : [extra])),
    child: (sub) => createLogger(`${scope}/${sub}`),
  };
}
