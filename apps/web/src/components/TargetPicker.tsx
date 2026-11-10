import { Divider } from '@rootnative/components/divider'
import { Icon } from '@rootnative/components/icon'
import { Menu } from '@rootnative/components/menu'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Device } from '../api/types'
import type { PickerView } from '../logic/install'
import { PlatformIcon } from './IconTile'

const SELECT = 'Select a device'

const styles = StyleSheet.create({
  anchor: { flexShrink: 1, minWidth: 0 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    minWidth: 0,
    paddingStart: 10,
    paddingEnd: 6,
    borderWidth: 1,
  },
  off: { opacity: 0.38 },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    flexShrink: 1,
  },
  name: { flexShrink: 1, maxWidth: 140 },
})

/**
 * The install target of each platform, in the toolbar. A press opens the
 * devices, by platform, with a check on each target.
 */
export function TargetPicker({
  picker,
  align,
  onSelect,
}: {
  picker: PickerView
  /** The side of the menu, for a picker at the end of the toolbar. */
  align: 'start' | 'end'
  onSelect: (device: Device) => void
}) {
  const { colors, shape } = useTheme()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const fieldStyle = [
    styles.field,
    {
      borderColor: colors.outlineVariant,
      borderRadius: shape.cornerSmall,
      backgroundColor:
        open || hovered ? colors.surfaceContainerHigh : 'transparent',
    },
  ]
  const chevron = (
    <Icon source="expand" size={14} color={colors.onSurfaceVariant} />
  )

  if (picker.kind === 'no-device') {
    return (
      <Tooltip
        side="bottom"
        align={align}
        anchor={
          <Pressable
            disabled
            role="button"
            aria-disabled
            aria-label={SELECT}
            style={[fieldStyle, styles.off]}
          >
            <Icon
              source="install-target"
              size={14}
              color={colors.onSurfaceVariant}
            />
            <Typography variant="labelMedium" color={colors.onSurfaceVariant}>
              {SELECT}
            </Typography>
            {chevron}
          </Pressable>
        }
      >
        {picker.reason}
      </Tooltip>
    )
  }

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      align={align}
      offset={4}
      maxHeight={420}
      dismissAccessibilityLabel="Close the devices"
      anchorStyle={styles.anchor}
      anchor={
        <Pressable
          onPress={() => setOpen(true)}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          role="button"
          aria-label={picker.accessibilityLabel}
          aria-expanded={open}
          style={fieldStyle}
        >
          {picker.targets.length === 0 ? (
            <View style={styles.target}>
              <Icon
                source="install-target"
                size={14}
                color={colors.onSurfaceVariant}
              />
              <Typography
                variant="labelMedium"
                color={colors.onSurfaceVariant}
                numberOfLines={1}
                style={styles.name}
              >
                {SELECT}
              </Typography>
            </View>
          ) : (
            picker.targets.map((device) => (
              <View key={device.id} style={styles.target}>
                <PlatformIcon platform={device.platform} size={13} />
                <Typography
                  variant="labelMedium"
                  color={colors.onSurface}
                  numberOfLines={1}
                  style={styles.name}
                >
                  {device.name}
                </Typography>
              </View>
            ))
          )}
          {chevron}
        </Pressable>
      }
    >
      {picker.groups.map((group, index) => (
        <Fragment key={group.platform}>
          {index > 0 && <Divider />}
          {group.items.map((item) => (
            <Menu.Item
              key={item.device.id}
              label={item.label}
              leadingIcon={
                <PlatformIcon platform={item.device.platform} size={16} />
              }
              trailingIcon={item.target ? 'check' : undefined}
              trailingText={item.state}
              disabled={item.state !== undefined}
              onPress={() => onSelect(item.device)}
            />
          ))}
        </Fragment>
      ))}
    </Menu>
  )
}
