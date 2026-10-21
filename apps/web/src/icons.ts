import { createLucideResolver } from '@rootnative/icons'
// One module for each icon. Metro does not tree-shake, so the package root
// would bundle every Lucide icon.
import Check from 'lucide-react-native/icons/check'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import CircleMinus from 'lucide-react-native/icons/circle-minus'
import CircleX from 'lucide-react-native/icons/circle-x'
import CloudDownload from 'lucide-react-native/icons/cloud-download'
import Download from 'lucide-react-native/icons/download'
import MonitorSmartphone from 'lucide-react-native/icons/monitor-smartphone'
import RefreshCw from 'lucide-react-native/icons/refresh-cw'
import Smartphone from 'lucide-react-native/icons/smartphone'
import Stethoscope from 'lucide-react-native/icons/stethoscope'
import TriangleAlert from 'lucide-react-native/icons/triangle-alert'
import UserCheck from 'lucide-react-native/icons/user-check'
import X from 'lucide-react-native/icons/x'

const ICONS = {
  refresh: RefreshCw,
  sync: CloudDownload,
  install: Download,
  'setup-check': Stethoscope,
  'status-ok': CircleCheck,
  'status-warn': TriangleAlert,
  'status-fail': CircleX,
  'status-skip': CircleMinus,
  'device-physical': Smartphone,
  'device-virtual': MonitorSmartphone,
  'eas-signed-in': UserCheck,
  // The components ask for these two by name, for example in a selected
  // chip or a dialog with a close button.
  check: Check,
  close: X,
}

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export const iconResolver = createLucideResolver({ icons: ICONS })
