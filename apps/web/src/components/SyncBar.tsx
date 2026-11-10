import { useTheme } from '@rootnative/core'
import { Motion, Presence, useShouldReduceMotion } from '@rootnative/inertia'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

const SEGMENT = 0.3
const PASS_DURATION = 1200

const styles = StyleSheet.create({
  // It floats on the top edge, so the status of a sync moves nothing.
  bar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    height: 2,
    overflow: 'hidden',
  },
  segment: { position: 'absolute', top: 0, bottom: 0, start: 0 },
})

/** The bar on the top edge of the panel while a sync runs. */
export function SyncBar({ visible }: { visible: boolean }) {
  return <Presence>{visible && <Bar key="bar" />}</Presence>
}

/**
 * A segment passes from start to end again and again. With reduced motion,
 * the bar is one still line.
 */
function Bar() {
  const { colors } = useTheme()
  const reduce = useShouldReduceMotion()
  const [width, setWidth] = useState(0)
  const segment = width * SEGMENT
  return (
    <Motion.View
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition="fade"
      style={styles.bar}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.primary, opacity: reduce ? 0.8 : 0.24 },
        ]}
      />
      {!reduce && width > 0 && (
        <Motion.View
          // A new width starts the pass again from the new start.
          key={width}
          style={[
            styles.segment,
            { width: segment, backgroundColor: colors.primary },
          ]}
          initial={{ translateX: -segment }}
          animate={{ translateX: width }}
          transition={{
            type: 'timing',
            duration: PASS_DURATION,
            repeat: { count: 'infinite', alternate: false },
          }}
        />
      )}
    </Motion.View>
  )
}
