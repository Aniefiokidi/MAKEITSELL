import { after } from 'next/server'

// next/server's after() runs work once the response is sent — but it throws when there
// is no request scope (a test, a script, a cron helper called directly). This wrapper
// falls back to running the task immediately (still detached, errors logged) so the
// same code works in every context.
export function deferAfterResponse(task: () => Promise<void> | void): void {
  try {
    after(task)
  } catch {
    Promise.resolve()
      .then(task)
      .catch((error) => console.error('[defer] deferred task failed:', error))
  }
}
