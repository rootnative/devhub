import { Button } from '@rootnative/components/button'
import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { StyleSheet, View } from 'react-native'
import type { DoctorReport, DoctorStatus } from '../api/types'
import type { IconName } from '../icons'
import {
  SETUP_INTRO,
  STATUS_HUE,
  doctorView,
  type DoctorRow,
  type DoctorState,
} from '../logic/doctor'
import { CHECK_INTERVAL } from '../theme'
import { useHue } from './IconTile'
import { Cascade, CascadeItem } from './Motion'
import { Notice } from './Notice'

const CHECK_ICON: IconName = 'setup-check'

const SUMMARY_HUE = { ok: 'green', warn: 'amber', fail: 'red' } as const

const styles = StyleSheet.create({
  notes: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  check: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  icon: { paddingTop: 1 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  label: { width: 64 },
  detail: { flexShrink: 1 },
})

/** The button in the page header that runs `devhub doctor`. */
export function CheckButton({
  state,
  onRun,
}: {
  state: DoctorState
  onRun: () => void
}) {
  return (
    <Button
      variant="outlined"
      size="extraSmall"
      shape="square"
      leadingIcon={CHECK_ICON}
      loading={state.running}
      onPress={onRun}
      accessibilityLabel="Check the tools and the store that DevHub uses"
    >
      {state.result === undefined ? 'Check' : 'Check again'}
    </Button>
  )
}

export function SetupSection({ state }: { state: DoctorState }) {
  const { colors } = useTheme()
  const { result } = state
  return (
    <View>
      {result === undefined && (
        <View style={styles.notes}>
          <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
            {SETUP_INTRO}
          </Typography>
        </View>
      )}
      {result?.kind === 'error' && (
        <View style={styles.notes}>
          <Notice tone="error">{result.message}</Notice>
        </View>
      )}
      {result?.kind === 'ok' && (
        // Each run of the checks shows its results one by one again.
        <DoctorResult key={state.checkedAt?.getTime()} report={result.value} />
      )}
    </View>
  )
}

/** The summary line, then one row for each check with its fix. */
function DoctorResult({ report }: { report: DoctorReport }) {
  const { colors } = useTheme()
  const view = doctorView(report)
  const tone = useHue(SUMMARY_HUE[view.tone])
  return (
    <Cascade interval={CHECK_INTERVAL}>
      <CascadeItem key="summary" style={styles.notes}>
        <Typography
          variant="labelLarge"
          color={view.tone === 'ok' ? colors.onSurfaceVariant : tone.ink}
          accessibilityLiveRegion="polite"
        >
          {view.summary}
        </Typography>
      </CascadeItem>
      {view.rows.map((row, index) => (
        <CheckRow
          key={row.id}
          row={row}
          status={report.checks[index]?.status ?? 'skip'}
        />
      ))}
    </Cascade>
  )
}

function CheckRow({ row, status }: { row: DoctorRow; status: DoctorStatus }) {
  const { colors } = useTheme()
  const tone = useHue(STATUS_HUE[status])
  return (
    <CascadeItem
      style={[styles.check, { borderBottomColor: colors.surfaceContainerHigh }]}
      accessible
      aria-label={`${row.chip}. ${row.detail}${row.fix === undefined ? '' : `. ${row.fix}`}`}
    >
      <View style={styles.icon}>
        <Icon source={row.icon} size={16} color={tone.ink} />
      </View>
      <View style={styles.text}>
        <View style={styles.line}>
          <Typography variant="labelLarge" style={styles.label}>
            {row.title}
          </Typography>
          <Typography
            variant="bodyMedium"
            color={colors.onSurfaceVariant}
            style={styles.detail}
            selectable
          >
            {row.detail}
          </Typography>
        </View>
        {row.fix !== undefined && (
          <Typography variant="bodySmall" color={tone.ink} selectable>
            {row.fix}
          </Typography>
        )}
      </View>
    </CascadeItem>
  )
}
