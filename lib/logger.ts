type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    let output = `[${timestamp}] ${level} ${entry.message}`;
    
    if (entry.context) {
      output += ` | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      output += ` | Error: ${entry.error.message}`;
      if (entry.error.stack && this.isDevelopment) {
        output += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return output;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };

    // Add to buffer for potential future use (e.g., error reporting)
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Only log to console in development or for errors/warnings
    if (this.isDevelopment || level === 'error' || level === 'warn') {
      const formattedLog = this.formatLog(entry);
      
      switch (level) {
        case 'debug':
          if (this.isDevelopment) console.debug(formattedLog);
          break;
        case 'info':
          if (this.isDevelopment) console.info(formattedLog);
          break;
        case 'warn':
          console.warn(formattedLog);
          break;
        case 'error':
          console.error(formattedLog);
          break;
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    if (error instanceof Error) {
      this.log('error', message, context, error);
    } else {
      this.log('error', message, { ...context, error: String(error) });
    }
  }

  // Get recent logs for debugging
  getRecentLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logBuffer.filter(entry => entry.level === level);
    }
    return [...this.logBuffer];
  }

  // Clear log buffer
  clearLogs() {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for API usage
export function apiLogger(request: Request, response: Response, duration: number) {
  const context = {
    method: request.method,
    url: request.url,
    status: response.status,
    duration: `${duration}ms`
  };

  if (response.status >= 500) {
    logger.error('API request failed', undefined, context);
  } else if (response.status >= 400) {
    logger.warn('API request client error', context);
  } else {
    logger.info('API request completed', context);
  }
}