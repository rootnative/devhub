/**
 * The build rows that show the tint of a new build. Each new set of rows
 * gets a new token, so a row that shows the tint again starts it again.
 */
export type RowTint = { ids: readonly string[]; token: number }

export const NO_TINT: RowTint = { ids: [], token: 0 }

export function tintRows(current: RowTint, ids: readonly string[]): RowTint {
  return { ids, token: current.token + 1 }
}

/** The tint token of a row, or `undefined` when the row has no tint. */
export function tintToken(tint: RowTint, id: string): number | undefined {
  return tint.ids.includes(id) ? tint.token : undefined
}

/** Ends the tint of `token`. A later tint stays. */
export function endTint(current: RowTint, token: number): RowTint {
  return current.token === token && current.ids.length > 0
    ? { ids: [], token }
    : current
}

/**
 * The same color with no opacity, so a fade to it changes the opacity only.
 * A fade to `transparent` (black with no opacity) goes through grey. Takes a
 * `#rrggbb` or an `rgba()` color.
 */
export function clearColor(color: string): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (hex !== null) {
    const [, r, g, b] = hex.map((part) => parseInt(part, 16))
    return `rgba(${r}, ${g}, ${b}, 0)`
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color)
  if (rgba !== null) {
    return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, 0)`
  }
  return 'rgba(0, 0, 0, 0)'
}
