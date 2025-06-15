/**
 * Cloudflare Workers compatible logger
 * Replaces Winston with console-based logging optimized for Workers
 */

export class Logger {
  constructor(service = 'Worker') {
    this.service = service;
    this.level = globalThis.LOG_LEVEL || 'info';
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      service: this.service,
      level,
      message,
      ...meta
    };

    // In Workers, console.log outputs to the dashboard
    if (this.shouldLog(level)) {
      console.log(JSON.stringify(logObject));
    }
  }

  shouldLog(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.level];
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    // Ensure error objects are serializable
    if (meta instanceof Error) {
      meta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack
      };
    }
    
    this.log('error', message, meta);
  }
}

// Create a default logger instance
export const logger = new Logger();