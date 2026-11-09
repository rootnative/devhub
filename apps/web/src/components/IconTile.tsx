import { Icon } from '@rootnative/components/icon'
import { useThemeMode } from '@rootnative/core'
import { View } from 'react-native'
import type { IconName } from '../icons'
import { HUES, type Hue, type HueTone } from '../theme'

/** The tint and the ink of a hue in the current mode. */
export function useHue(hue: Hue): HueTone {
  const { scheme } = useThemeMode()
  return HUES[scheme][hue]
}

const TILE = {
  small: { size: 20, radius: 5, icon: 13 },
  large: { size: 26, radius: 6, icon: 15 },
}

/** An icon on a tile of its hue. The label next to it names it. */
export function IconTile({
  icon,
  hue,
  size = 'small',
}: {
  icon: IconName
  hue: Hue
  size?: keyof typeof TILE
}) {
  const tone = useHue(hue)
  const tile = TILE[size]
  return (
    <View
      aria-hidden
      style={{
        width: tile.size,
        height: tile.size,
        borderRadius: tile.radius,
        backgroundColor: tone.tint,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon source={icon} size={tile.icon} color={tone.ink} />
    </View>
  )
}

/** An icon in the ink of its hue, with no tile. */
export function HueIcon({
  icon,
  hue,
  size = 14,
}: {
  icon: IconName
  hue: Hue
  size?: number
}) {
  const tone = useHue(hue)
  return <Icon source={icon} size={size} color={tone.ink} />
}

/** The icon of a platform: green for Android, blue for iOS. */
export function PlatformIcon({
  platform,
  size = 14,
}: {
  platform: 'android' | 'ios'
  size?: number
}) {
  return (
    <HueIcon
      icon={platform}
      hue={platform === 'android' ? 'green' : 'blue'}
      size={size}
    />
  )
}
