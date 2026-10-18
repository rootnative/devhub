/**
 * The result of a flow that the CLI and the `devhub ui` server share. A flow
 * writes nothing to stdout or stderr. The CLI prints the message of an
 * error, and the server sends it as `{ "error": message }`.
 */
export type FlowResult<T> = { kind: 'ok'; value: T } | FlowError

/** `usage`: the fix is an option of the command, so the CLI exit code is 2. */
export type FlowError = { kind: 'error'; message: string; usage: boolean }

export function failure(message: string): FlowError {
  return { kind: 'error', message, usage: false }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
