import { Button } from '@rootnative/components/button'
import { Card } from '@rootnative/components/card'
import { Chip } from '@rootnative/components/chip'
import { Column, Row } from '@rootnative/components/layout'
import { List, ListDivider, ListItem } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import type { ApiResult } from '../api/client'
import type { DoctorReport } from '../api/types'
import { SETUP_INTRO, doctorView } from '../logic/doctor'
import { Notice } from './Notice'

/** The last result stays on the page while the checks run again. */
export type DoctorState = {
  running: boolean
  result?: ApiResult<DoctorReport>
}

export function SetupSection({
  state,
  onRun,
}: {
  state: DoctorState
  onRun: () => void
}) {
  const { result } = state
  return (
    <Column gap="md">
      <Row justify="space-between" align="center" gap="md">
        <Typography variant="titleLarge" level={2}>
          Setup
        </Typography>
        <Button
          variant="tonal"
          loading={state.running}
          onPress={onRun}
          accessibilityLabel="Check the tools and the store that DevHub uses"
        >
          {result === undefined ? 'Check' : 'Check again'}
        </Button>
      </Row>
      {result === undefined && <Notice>{SETUP_INTRO}</Notice>}
      {result?.kind === 'error' && (
        <Notice tone="error">{result.message}</Notice>
      )}
      {result?.kind === 'ok' && <DoctorResult report={result.value} />}
    </Column>
  )
}

function DoctorResult({ report }: { report: DoctorReport }) {
  const { colors } = useTheme()
  const view = doctorView(report)
  return (
    <>
      <Typography
        variant="labelMedium"
        color={view.tone === 'ok' ? colors.onSurfaceVariant : colors.error}
        accessibilityLiveRegion="polite"
      >
        {view.summary}
      </Typography>
      <Card variant="outlined">
        <List>
          {view.rows.map((row, index) => (
            <Fragment key={row.id}>
              {index > 0 && <ListDivider />}
              <ListItem
                headlineText={row.title}
                supportingText={row.text}
                // 0 is no limit, so the page never cuts a fix.
                supportingTextNumberOfLines={0}
                trailingContent={
                  <Chip contentColor={row.problem ? colors.error : undefined}>
                    {row.status}
                  </Chip>
                }
              />
            </Fragment>
          ))}
        </List>
      </Card>
    </>
  )
}
