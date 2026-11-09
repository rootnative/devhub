import { Button } from '@rootnative/components/button'
import { ButtonGroup } from '@rootnative/components/button-group'
import { Dialog } from '@rootnative/components/dialog'
import { Column, Row } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme, useThemeMode, type ThemeMode } from '@rootnative/core'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { IconName } from '../icons'
import { isThemeMode } from '../logic/themeCookie'
import { MONO_WRAP } from '../theme'
import { IconTile } from './IconTile'

const MODES: { value: ThemeMode; label: string; leadingIcon: IconName }[] = [
  { value: 'system', label: 'System', leadingIcon: 'mode-system' },
  { value: 'light', label: 'Light', leadingIcon: 'mode-light' },
  { value: 'dark', label: 'Dark', leadingIcon: 'mode-dark' },
]

const styles = StyleSheet.create({
  path: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingStart: 12,
    paddingEnd: 6,
    paddingVertical: 6,
  },
  pathText: { flex: 1, minWidth: 0 },
})

type Copy = 'idle' | 'done' | 'failed'

/**
 * The settings of DevHub: the appearance, and the store folder. A later
 * version adds the change of the folder and the move of the builds here.
 */
export function SettingsDialog({
  visible,
  onDismiss,
  store,
}: {
  visible: boolean
  onDismiss: () => void
  /** `undefined` while the page reads the store. */
  store: string | undefined
}) {
  const { colors, shape } = useTheme()
  const { mode, setMode } = useThemeMode()
  const [copy, setCopy] = useState<Copy>('idle')
  const close = () => {
    setCopy('idle')
    onDismiss()
  }
  const copyPath = () => {
    const clipboard: Clipboard | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (store === undefined || clipboard === undefined) {
      setCopy('failed')
      return
    }
    clipboard.writeText(store).then(
      () => setCopy('done'),
      () => setCopy('failed'),
    )
  }
  return (
    <Dialog visible={visible} onDismiss={close}>
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Content>
        <Column gap="lg">
          <Column gap="sm">
            <Row gap="sm" align="center">
              <IconTile icon="appearance" hue="slate" />
              <Typography variant="labelLarge" level={3}>
                Appearance
              </Typography>
            </Row>
            <ButtonGroup
              variant="connected"
              selectionMode="single"
              size="extraSmall"
              value={mode}
              onValueChange={(next) => {
                if (isThemeMode(next)) {
                  setMode(next)
                }
              }}
              items={MODES}
              accessibilityLabel="Appearance"
            />
            <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
              System follows the light or dark mode of your computer.
            </Typography>
          </Column>
          <Column gap="sm">
            <Row gap="sm" align="center">
              <IconTile icon="builds" hue="violet" />
              <Typography variant="labelLarge" level={3}>
                Store
              </Typography>
            </Row>
            <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
              DevHub keeps every build in this folder.
            </Typography>
            <View
              style={[
                styles.path,
                {
                  borderColor: colors.outlineVariant,
                  borderRadius: shape.cornerSmall,
                  backgroundColor: colors.surfaceContainerLow,
                },
              ]}
            >
              <Typography
                variant="bodySmall"
                style={[MONO_WRAP, styles.pathText]}
                selectable
              >
                {store ?? 'Reading the store.'}
              </Typography>
              <Button
                variant="outlined"
                size="extraSmall"
                shape="square"
                leadingIcon={copy === 'done' ? 'check' : 'copy'}
                disabled={store === undefined}
                onPress={copyPath}
                accessibilityLabel="Copy the path of the store folder"
              >
                {copy === 'done' ? 'Copied' : 'Copy'}
              </Button>
            </View>
            {copy === 'failed' && (
              <Typography variant="bodySmall" color={colors.error}>
                The browser did not allow the copy. Select the path, and copy
                it.
              </Typography>
            )}
          </Column>
        </Column>
      </Dialog.Content>
      <Dialog.Actions>
        <Button variant="text" onPress={close}>
          Done
        </Button>
      </Dialog.Actions>
    </Dialog>
  )
}
