import { useThemeMode } from '@rootnative/core'
import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { DARK_TONES, LIGHT_TONES } from '../theme'

/**
 * The compact form of the mark, from assets/brand/devhub-mark-compact.svg.
 * The title next to it names the product, so screen readers skip it.
 */
export function Mark({ size = 28 }: { size?: number }) {
  const { scheme } = useThemeMode()
  const tones = scheme === 'dark' ? DARK_TONES : LIGHT_TONES
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="12 12 40 40">
        <Path
          d="M 12 12 L 35 12 L 35 23 L 27 23 L 27 52 L 12 52 Z"
          fill={tones.soft}
        />
        <Path
          d="M 40 12 L 52 12 L 52 52 L 32 52 L 32 28 L 40 28 Z"
          fill={tones.strong}
        />
      </Svg>
    </View>
  )
}
