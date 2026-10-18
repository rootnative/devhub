import { Card } from '@rootnative/components/card'
import { Column } from '@rootnative/components/layout'
import { List, ListDivider, ListItem } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import type { BuildList } from '../api/types'
import type { ApiState } from '../api/useApi'
import { groupBuilds, storeNotes } from '../logic/view'
import { Notice } from './Notice'

const NO_BUILD = 'The store has no builds. Run devhub sync in a project folder.'

export function BuildsSection({
  state,
  now,
}: {
  state: ApiState<BuildList>
  now: Date
}) {
  const { colors } = useTheme()
  return (
    <Column gap="md">
      <Typography variant="titleLarge" level={2}>
        Builds
      </Typography>
      {state.kind === 'loading' && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
          Reading the store.
        </Typography>
      )}
      {state.kind === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.kind === 'ok' && (
        <>
          {storeNotes(state.value).map((note) => (
            <Notice key={note}>{note}</Notice>
          ))}
          {state.value.builds.length === 0 && <Notice>{NO_BUILD}</Notice>}
          {groupBuilds(state.value, now).map((group) => (
            <Card key={group.project} variant="outlined">
              <List headline={group.project} headingLevel={3}>
                {group.builds.map((build, index) => (
                  <Fragment key={build.id}>
                    {index > 0 && <ListDivider />}
                    <ListItem
                      overlineText={build.shortId}
                      headlineText={build.title}
                      supportingText={
                        build.expiry === ''
                          ? build.details
                          : `${build.details}\n${build.expiry}`
                      }
                      supportingTextNumberOfLines={4}
                      trailingSupportingText={build.size}
                    />
                  </Fragment>
                ))}
              </List>
            </Card>
          ))}
        </>
      )}
    </Column>
  )
}
