import { Card } from '@rootnative/components/card'
import { Chip } from '@rootnative/components/chip'
import { Column, Row } from '@rootnative/components/layout'
import { ListDivider } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import { View, type TextStyle } from 'react-native'
import type { DeviceReport } from '../api/types'
import type { ApiState } from '../api/useApi'
import { deviceRow, type DeviceRow } from '../logic/view'
import { MONO_FONT } from '../theme'
import { Notice } from './Notice'

const NO_DEVICE =
  'No device runs now. Start an emulator, or connect an Android device with USB debugging on. On macOS, you can also boot a simulator.'

// react-native-web passes wordBreak to the browser, but the React Native
// type does not have it. A simulator UDID has no space to break at.
const DEVICE_ID_STYLE = {
  fontFamily: MONO_FONT,
  letterSpacing: 0,
  wordBreak: 'break-all',
} as TextStyle

export function DevicesSection({ state }: { state: ApiState<DeviceReport> }) {
  const { colors } = useTheme()
  return (
    <Column gap="md">
      <Typography variant="titleLarge" level={2}>
        Devices
      </Typography>
      {state.kind === 'loading' && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
          Reading the devices.
        </Typography>
      )}
      {state.kind === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.kind === 'ok' && (
        <>
          {state.value.warnings.map((warning) => (
            <Notice key={warning} tone="error">
              {warning}
            </Notice>
          ))}
          {state.value.devices.length === 0 ? (
            state.value.warnings.length === 0 && <Notice>{NO_DEVICE}</Notice>
          ) : (
            <Card variant="outlined">
              {state.value.devices.map(deviceRow).map((row, index) => (
                <Fragment key={row.id}>
                  {index > 0 && <ListDivider />}
                  <Device row={row} />
                </Fragment>
              ))}
            </Card>
          )}
        </>
      )}
    </Column>
  )
}

/**
 * One device. The chip goes next to the name when both fit, and the fix has
 * no line limit, so a narrow column cuts no text.
 */
function Device({ row }: { row: DeviceRow }) {
  const { colors } = useTheme()
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}>
      <Row justify="space-between" align="center" gap="sm">
        <Typography variant="bodyLarge" style={{ flexShrink: 1 }}>
          {row.title}
        </Typography>
        <Chip contentColor={row.ready ? undefined : colors.error}>
          {row.status}
        </Chip>
      </Row>
      <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
        {row.kind}
      </Typography>
      {row.deviceId !== undefined && (
        <Typography
          variant="bodySmall"
          color={colors.onSurfaceVariant}
          style={DEVICE_ID_STYLE}
          selectable
        >
          {row.deviceId}
        </Typography>
      )}
      {row.problem !== undefined && (
        <Typography variant="bodySmall" color={colors.error} selectable>
          {row.problem}
        </Typography>
      )}
    </View>
  )
}
