import { Icon } from '@rootnative/components/icon'
import { Row } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { StyleSheet, View } from 'react-native'
import type { Device, DeviceReport } from '../api/types'
import type { ApiState } from '../api/useApi'
import type { IconName } from '../icons'
import { NO_DEVICE } from '../logic/install'
import { deviceRow } from '../logic/view'
import { MONO_WRAP } from '../theme'
import { IconTile, useHue } from './IconTile'
import { Cascade, CascadeItem } from './Motion'
import { Notice } from './Notice'

const styles = StyleSheet.create({
  notes: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  device: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { flexShrink: 1 },
  id: { flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
})

export function DevicesSection({ state }: { state: ApiState<DeviceReport> }) {
  const { colors } = useTheme()
  const devices = state.kind === 'ok' ? state.value.devices : []
  const warnings = state.kind === 'ok' ? state.value.warnings : []
  return (
    <View>
      {(state.kind !== 'ok' || warnings.length > 0 || devices.length === 0) && (
        <View style={styles.notes}>
          {state.kind === 'loading' && (
            <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
              Reading the devices.
            </Typography>
          )}
          {state.kind === 'error' && (
            <Notice tone="error">{state.message}</Notice>
          )}
          {warnings.map((warning) => (
            <Notice key={warning} tone="error">
              {warning}
            </Notice>
          ))}
          {state.kind === 'ok' &&
            devices.length === 0 &&
            warnings.length === 0 && <Notice>{NO_DEVICE}</Notice>}
        </View>
      )}
      <Cascade>
        {devices.map((device) => (
          <DeviceItem key={device.id} device={device} />
        ))}
      </Cascade>
    </View>
  )
}

/**
 * One device. The state goes next to the name when both fit, and under it
 * when they do not. The fix has no line limit, so a narrow column cuts no
 * text.
 */
function DeviceItem({ device }: { device: Device }) {
  const { colors } = useTheme()
  const row = deviceRow(device)
  const muted = colors.onSurfaceVariant
  return (
    <CascadeItem
      style={[
        styles.device,
        { borderBottomColor: colors.surfaceContainerHigh },
      ]}
    >
      <IconTile
        icon={device.platform}
        hue={device.platform === 'android' ? 'green' : 'blue'}
        size="large"
      />
      <View style={styles.text}>
        <Row wrap justify="space-between" align="center" gap="sm">
          <Typography variant="labelLarge" style={styles.name}>
            {row.title}
          </Typography>
          <StatePill
            ready={row.ready}
            label={row.status}
            icon={row.statusIcon}
          />
        </Row>
        <Row wrap align="center" gap="xs">
          <Icon source={row.kindIcon} size={14} color={muted} />
          <Typography variant="bodySmall" color={muted}>
            {row.deviceId === undefined ? row.kind : `${row.kind} ·`}
          </Typography>
          {row.deviceId !== undefined && (
            <Typography
              variant="bodySmall"
              color={muted}
              style={[MONO_WRAP, styles.id]}
              selectable
            >
              {row.deviceId}
            </Typography>
          )}
        </Row>
        {row.problem !== undefined && (
          <Typography variant="bodySmall" color={colors.error} selectable>
            {row.problem}
          </Typography>
        )}
      </View>
    </CascadeItem>
  )
}

/** The state of a device on the tint of its hue. */
function StatePill({
  ready,
  label,
  icon,
}: {
  ready: boolean
  label: string
  icon: IconName
}) {
  const { colors } = useTheme()
  const tone = useHue(ready ? 'green' : 'red')
  return (
    <View style={[styles.pill, { backgroundColor: tone.tint }]}>
      <Icon source={icon} size={12} color={tone.ink} />
      <Typography variant="labelMedium" color={colors.onSurface}>
        {label}
      </Typography>
    </View>
  )
}
