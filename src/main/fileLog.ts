import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// A small log file for the installed app, where nobody sees the console: one line per message, and only
// the newest part of the file when it becomes too large. Writing must never break the app.

export type Logger = {
  info(message?: unknown): void
  warn(message?: unknown): void
  error(message?: unknown): void
  debug(message: string): void
}

const text = (message: unknown) => (message instanceof Error ? (message.stack ?? message.message) : String(message))

export function createFileLog(file: string, { maxBytes = 100 * 1024, now = () => new Date() } = {}): Logger {
  const write = (level: string, message: unknown) => {
    try {
      mkdirSync(dirname(file), { recursive: true })
      let size = 0
      try {
        size = statSync(file).size
      } catch {
        // No file yet.
      }
      if (size > maxBytes) {
        // Keep the newest half, from the start of a line.
        const old = readFileSync(file, 'utf8')
        const rest = old.slice(old.length - Math.floor(maxBytes / 2))
        writeFileSync(file, rest.slice(rest.indexOf('\n') + 1))
      }
      appendFileSync(file, `${now().toISOString()} ${level} ${text(message)}\n`)
    } catch {
      // A log that cannot be written is not a reason to stop the app.
    }
  }
  return {
    info: (message) => write('INFO', message),
    warn: (message) => write('WARN', message),
    error: (message) => write('ERROR', message),
    debug: (message) => write('DEBUG', message)
  }
}
