import { Typography } from '@rootnative/components/typography'
import {
  Motion,
  Stagger,
  useAnimation,
  useColorTransition,
} from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { StyleSheet, type ViewProps } from 'react-native'
import { clearColor } from '../logic/tint'
import { ROW_INTERVAL } from '../theme'
import { useHue } from './IconTile'

const HIDDEN = { opacity: 0, translateY: 4 }
const SHOWN = { opacity: 1, translateY: 0 }
const BELOW = { opacity: 0, translateY: 6 }

/**
 * Rows that fade in one after the other when they mount. A row that leaves
 * goes at once: an exit would keep it in the layout, and the rows under it
 * would move two times.
 */
export function Cascade({
  interval = ROW_INTERVAL,
  children,
}: {
  interval?: number
  children: ReactNode
}) {
  return <Stagger interval={interval}>{children}</Stagger>
}

/** One row of a cascade. It fades in and rises a little when it mounts. */
export function CascadeItem(props: ViewProps) {
  return (
    <Motion.View
      initial={HIDDEN}
      animate={SHOWN}
      transition="rise"
      {...props}
    />
  )
}

/**
 * A value that rises into place when it changes. The first value shows at
 * once.
 */
export function RisingValue({
  value,
  ...text
}: { value: string } & Omit<ComponentProps<typeof Typography>, 'children'>) {
  const [shown, setShown] = useState({ value, changes: 0 })
  if (shown.value !== value) {
    setShown({ value, changes: shown.changes + 1 })
  }
  return (
    <Motion.View
      key={shown.changes}
      initial={shown.changes === 0 ? false : BELOW}
      animate={SHOWN}
      transition="rise"
    >
      <Typography {...text}>{value}</Typography>
    </Motion.View>
  )
}

/**
 * The amber tint of a new build row, which fades out. Give it a new `key`
 * to start it again. It goes under the content of its row.
 */
export function RowTint() {
  const amber = useHue('amber').tint
  const progress = useAnimation(1, 'tint', { from: 0 })
  const color = useColorTransition(progress, [amber, clearColor(amber)])
  return (
    <Animated.View
      aria-hidden
      style={[StyleSheet.absoluteFill, styles.tint, color]}
    />
  )
}

const styles = StyleSheet.create({
  tint: { pointerEvents: 'none' },
})
