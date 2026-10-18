import { Button } from '@rootnative/components/button'
import { Menu } from '@rootnative/components/menu'
import type { Device, ListedBuild } from '../api/types'
import { deviceLabel, installChoice } from '../logic/install'

const KIND_LABEL: Record<Device['kind'], string> = {
  emulator: 'emulator',
  physical: 'device',
  simulator: 'simulator',
}

export function InstallButton({
  build,
  shortId,
  devices,
  installing,
  locked,
  onInstall,
}: {
  build: ListedBuild
  shortId: string
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  /** This build installs now. */
  installing: boolean
  /** An install of another build runs now. */
  locked: boolean
  onInstall: (device: Device) => void
}) {
  const choice = installChoice(build, devices)
  if (choice.kind === 'refused') {
    return null
  }
  if (choice.kind === 'many' && !installing && !locked) {
    return (
      <Menu
        align="end"
        anchor={
          <Button
            variant="tonal"
            accessibilityLabel={`Install the build ${shortId}. Select the device.`}
          >
            Install
          </Button>
        }
      >
        {choice.devices.map((device) => (
          <Menu.Item
            key={device.id}
            label={deviceLabel(device)}
            trailingText={KIND_LABEL[device.kind]}
            onPress={() => onInstall(device)}
          />
        ))}
      </Menu>
    )
  }
  const only = choice.kind === 'one' ? choice.device : undefined
  return (
    <Button
      variant="tonal"
      loading={installing}
      disabled={locked || choice.kind === 'no-device'}
      accessibilityLabel={
        only === undefined
          ? `Install the build ${shortId}`
          : `Install the build ${shortId} on ${deviceLabel(only)}`
      }
      onPress={only === undefined ? undefined : () => onInstall(only)}
    >
      Install
    </Button>
  )
}
