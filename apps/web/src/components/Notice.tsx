import { Card } from '@rootnative/components/card'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'

/** A message in place of a list: an empty list, a warning, or an error. */
export function Notice({
  children,
  tone = 'info',
}: {
  children: string
  tone?: 'info' | 'error'
}) {
  const { colors } = useTheme()
  return (
    <Card
      variant="filled"
      containerColor={
        tone === 'error' ? colors.errorContainer : colors.surfaceContainer
      }
    >
      <Card.Content>
        <Typography
          variant="bodyMedium"
          color={tone === 'error' ? colors.onErrorContainer : colors.onSurface}
        >
          {children}
        </Typography>
      </Card.Content>
    </Card>
  )
}
