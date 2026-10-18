import { Card } from '@rootnative/components/card'
import { Chip } from '@rootnative/components/chip'
import { Column } from '@rootnative/components/layout'
import { List, ListDivider, ListItem } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import type { DeviceReport } from '../api/types'
import type { ApiState } from '../api/useApi'
import { deviceRow } from '../logic/view'
import { Notice } from './Notice'

const NO_DEVICE =
  'No device runs now. Start an emulator, or connect an Android device with USB debugging on. On macOS, you can also boot a simulator.'

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
              <List>
                {state.value.devices.map(deviceRow).map((row, index) => (
                  <Fragment key={row.id}>
                    {index > 0 && <ListDivider />}
                    <ListItem
                      headlineText={row.title}
                      supportingText={
                        row.problem === undefined
                          ? row.details
                          : `${row.details}\n${row.problem}`
                      }
                      supportingTextNumberOfLines={4}
                      trailingContent={
                        <Chip
                          contentColor={row.ready ? undefined : colors.error}
                        >
                          {row.status}
                        </Chip>
                      }
                    />
                  </Fragment>
                ))}
              </List>
            </Card>
          )}
        </>
      )}
    </Column>
  )
}
