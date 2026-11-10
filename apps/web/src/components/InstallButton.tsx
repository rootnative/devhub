import { Button } from '@rootnative/components/button'
import { Menu } from '@rootnative/components/menu'
import { Tooltip } from '@rootnative/components/tooltip'
import type { Device, ListedBuild } from '../api/types'
import type { IconName } from '../icons'
import {
  deviceLabel,
  installOnLabel,
  rowInstall,
  type InstallTargets,
} from '../logic/install'

const INSTALL_ICON: IconName = 'install'

const KIND_LABEL: Record<Device['kind'], string> = {
  emulator: 'emulator',
  physical: 'device',
  simulator: 'simulator',
}

export function InstallButton({
  size,
  build,
  shortId,
  devices,
  targets,
  installing,
  locked,
  onInstall,
}: {
  /** The size of the button. The default is the `Button` default. */
  size?: 'extraSmall' | 'small'
  build: ListedBuild
  shortId: string
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  targets: InstallTargets
  /** This build installs now. */
  installing: boolean
  /** An install of another build runs now. */
  locked: boolean
  onInstall: (device: Device) => void
}) {
  const choice = rowInstall(build, targets, devices)
  if (choice.kind === 'refused') {
    return null
  }
  if (choice.kind === 'many' && !installing && !locked) {
    return (
      <Menu
        align="end"
        anchor={
          <Button
            variant="outlined"
            size={size}
            shape="square"
            leadingIcon={INSTALL_ICON}
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
  const label =
    only === undefined
      ? `Install the build ${shortId}`
      : installOnLabel(shortId, only)
  const button = (
    <Button
      variant="outlined"
      size={size}
      shape="square"
      leadingIcon={INSTALL_ICON}
      loading={installing}
      disabled={locked || choice.kind === 'no-device'}
      accessibilityLabel={label}
      onPress={only === undefined ? undefined : () => onInstall(only)}
    >
      Install
    </Button>
  )
  return only === undefined ? (
    button
  ) : (
    <Tooltip side="top" align="end" anchor={button}>
      {label}
    </Tooltip>
  )
}
