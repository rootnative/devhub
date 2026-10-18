import type { CliContext } from '../cli/context'
import { listDevices } from '../devices/list'
import { deviceReport } from '../flow/devices'
import { installStoredBuild } from '../flow/install'
import { listBuilds } from '../flow/list'
import type { FlowResult } from '../flow/result'
import { syncBuilds } from '../flow/sync'
import { isRecord } from '../store/files'
import { resolveHome } from '../store/home'

export type ApiResponse = { status: number; body: unknown }

type ApiRoute = {
  method: 'GET' | 'POST'
  handle: (body: unknown, context: CliContext) => Promise<ApiResponse>
}

/** Each route returns the JSON of one CLI command with `--json`. */
export const API_ROUTES: Readonly<Record<string, ApiRoute>> = {
  '/api/builds': {
    method: 'GET',
    handle: async (_body, context) =>
      fromFlow(await listBuilds(resolveHome(context), context.platform)),
  },
  '/api/devices': {
    method: 'GET',
    handle: async (_body, context) => ({
      status: 200,
      body: deviceReport(await listDevices(context)),
    }),
  },
  '/api/install': {
    method: 'POST',
    handle: async (body, context) => {
      // The page always names the device, so the server never selects one.
      if (
        !isRecord(body) ||
        !isNonEmptyString(body.id) ||
        !isNonEmptyString(body.device)
      ) {
        return apiError(
          400,
          'The request needs "id", the build ID, and "device", the device ID.',
        )
      }
      return fromFlow(
        await installStoredBuild(
          { id: body.id, device: body.device },
          { ...context, progress: (text) => context.io.err(text) },
        ),
      )
    },
  },
  '/api/sync': {
    method: 'POST',
    handle: async (_body, context) =>
      fromFlow(
        await syncBuilds(
          { all: true, extraProfiles: [], dryRun: false },
          { ...context, progress: (text) => context.io.err(text) },
        ),
      ),
  },
}

export function apiError(status: number, message: string): ApiResponse {
  return { status, body: { error: message } }
}

/** A usage error is `400`, the same as CLI exit code 2. A failure is `422`. */
function fromFlow<T>(result: FlowResult<T>): ApiResponse {
  if (result.kind === 'ok') {
    return { status: 200, body: result.value }
  }
  return apiError(result.usage ? 400 : 422, result.message)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
