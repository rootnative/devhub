import type { Command } from '../command/run-command'

/** The command that opens `url` in the default browser of the system. */
export function openUrlCommand(
  url: string,
  platform: NodeJS.Platform,
): Command {
  if (platform === 'darwin') {
    return ['open', url]
  }
  if (platform === 'win32') {
    // `start` is a cmd.exe builtin and needs a shell string. rundll32 needs
    // no shell.
    return ['rundll32', 'url.dll,FileProtocolHandler', url]
  }
  return ['xdg-open', url]
}
