/**
 * Logger Utility
 * Centralized logging with levels and file output
 */
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Current log level (can be changed at runtime)
 */
let currentLevel = LogLevel.INFO;

/**
 * Log file path
 */
let logFilePath: string | null = null;

/**
 * Initialize logger
 */
export function initLogger(): void {
  try {
    const logDir = join(app.getPath('userData'), 'logs');
    
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    logFilePath = join(logDir, `clawx-${timestamp}.log`);
  } catch (error) {
    console.error('Failed to initialize logger:', error);
  }
}

/**
 * Set log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Format log message
 */
function formatMessage(level: string, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ') : '';
  
  return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
}

/**
 * Write to log file
 */
function writeToFile(formatted: string): void {
  if (logFilePath) {
    try {
      appendFileSync(logFilePath, formatted + '\n');
    } catch {
      // Silently fail if we can't write to file
    }
  }
}

/**
 * Log debug message
 */
export function debug(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.DEBUG) {
    const formatted = formatMessage('DEBUG', message, ...args);
    console.debug(formatted);
    writeToFile(formatted);
  }
}

/**
 * Log info message
 */
export function info(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.INFO) {
    const formatted = formatMessage('INFO', message, ...args);
    console.info(formatted);
    writeToFile(formatted);
  }
}

/**
 * Log warning message
 */
export function warn(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.WARN) {
    const formatted = formatMessage('WARN', message, ...args);
    console.warn(formatted);
    writeToFile(formatted);
  }
}

/**
 * Log error message
 */
export function error(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.ERROR) {
    const formatted = formatMessage('ERROR', message, ...args);
    console.error(formatted);
    writeToFile(formatted);
  }
}

/**
 * Logger namespace export
 */
export const logger = {
  debug,
  info,
  warn,
  error,
  setLevel: setLogLevel,
  init: initLogger,
};
