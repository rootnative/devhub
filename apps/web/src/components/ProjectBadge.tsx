import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme, useThemeMode } from '@rootnative/core'
import { View } from 'react-native'
import type { IconName } from '../icons'
import { projectInitials, projectTone } from '../logic/sidebar'
import { AVATAR_TONES } from '../theme'

const ALL_ICON: IconName = 'all-projects'

/**
 * The initials of a project on its color, or the grid for all projects. A
 * rounded square, because the store has no app icon of a project.
 */
export function ProjectBadge({
  project,
  size,
}: {
  /** `undefined` for all projects. */
  project: string | undefined
  size: number
}) {
  const { colors } = useTheme()
  const { scheme } = useThemeMode()
  const tones = AVATAR_TONES[scheme]
  const tone =
    project === undefined
      ? undefined
      : tones[projectTone(project, tones.length)]
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        backgroundColor: tone?.container ?? colors.surfaceContainerHighest,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {project === undefined ? (
        <Icon
          source={ALL_ICON}
          size={Math.round(size * 0.6)}
          color={colors.onSurfaceVariant}
        />
      ) : (
        <Typography
          variant="labelSmall"
          color={tone?.content}
          style={{
            fontSize: Math.round(size * 0.42),
            lineHeight: size,
            fontWeight: '700',
          }}
        >
          {projectInitials(project)}
        </Typography>
      )}
    </View>
  )
}
