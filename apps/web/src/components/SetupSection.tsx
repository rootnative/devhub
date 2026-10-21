import { Button } from '@rootnative/components/button'
import { Chip } from '@rootnative/components/chip'
import { Column, Row } from '@rootnative/components/layout'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
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
  const { colors } = useTheme()
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
      {result === undefined && (
        <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
          {SETUP_INTRO}
        </Typography>
      )}
      {result?.kind === 'error' && (
        <Notice tone="error">{result.message}</Notice>
      )}
      {result?.kind === 'ok' && <DoctorResult report={result.value} />}
    </Column>
  )
}

/**
 * One chip for each check, with what DevHub found as its tooltip, and the
 * fix of each warning and failure under the chips.
 */
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
      <Row wrap gap="sm">
        {view.rows.map((row) => (
          <Tooltip
            key={row.id}
            side="bottom"
            duration={0}
            anchor={
              <Chip
                contentColor={row.problem ? colors.error : undefined}
                accessibilityLabel={`${row.chip}. ${row.detail}`}
              >
                {row.chip}
              </Chip>
            }
          >
            {row.detail}
          </Tooltip>
        ))}
      </Row>
      {view.rows.map(
        (row) =>
          row.fix !== undefined && (
            <Column key={row.id} gap="xs">
              <Typography variant="labelLarge" color={colors.error}>
                {`${row.title}: ${row.detail}`}
              </Typography>
              <Typography variant="bodySmall" selectable>
                {row.fix}
              </Typography>
            </Column>
          ),
      )}
    </>
  )
}
