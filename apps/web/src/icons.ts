import { createLucideResolver } from '@rootnative/icons'
// One module for each icon. Metro does not tree-shake, so the package root
// would bundle every Lucide icon.
import Apple from 'lucide-react-native/icons/apple'
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right'
import Bot from 'lucide-react-native/icons/bot'
import Check from 'lucide-react-native/icons/check'
import ChevronsUpDown from 'lucide-react-native/icons/chevrons-up-down'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import CircleMinus from 'lucide-react-native/icons/circle-minus'
import CircleX from 'lucide-react-native/icons/circle-x'
import Clock from 'lucide-react-native/icons/clock'
import Cloud from 'lucide-react-native/icons/cloud'
import CloudCheck from 'lucide-react-native/icons/cloud-check'
import CloudDownload from 'lucide-react-native/icons/cloud-download'
import Copy from 'lucide-react-native/icons/copy'
import Download from 'lucide-react-native/icons/download'
import Grip from 'lucide-react-native/icons/grip'
import HardDrive from 'lucide-react-native/icons/hard-drive'
import Hourglass from 'lucide-react-native/icons/hourglass'
import Laptop from 'lucide-react-native/icons/laptop'
import Menu from 'lucide-react-native/icons/menu'
import Monitor from 'lucide-react-native/icons/monitor'
import MonitorSmartphone from 'lucide-react-native/icons/monitor-smartphone'
import Moon from 'lucide-react-native/icons/moon'
import Package from 'lucide-react-native/icons/package'
import RefreshCw from 'lucide-react-native/icons/refresh-cw'
import Settings from 'lucide-react-native/icons/settings'
import Smartphone from 'lucide-react-native/icons/smartphone'
import Stethoscope from 'lucide-react-native/icons/stethoscope'
import Sun from 'lucide-react-native/icons/sun'
import SunMoon from 'lucide-react-native/icons/sun-moon'
import TriangleAlert from 'lucide-react-native/icons/triangle-alert'
import X from 'lucide-react-native/icons/x'

const ICONS = {
  refresh: RefreshCw,
  menu: Menu,
  swap: ArrowLeftRight,
  chevrons: ChevronsUpDown,
  'all-projects': Grip,
  builds: Package,
  sync: CloudDownload,
  install: Download,
  settings: Settings,
  copy: Copy,
  appearance: SunMoon,
  'mode-system': Monitor,
  'mode-light': Sun,
  'mode-dark': Moon,
  'setup-check': Stethoscope,
  'status-ok': CircleCheck,
  'status-warn': TriangleAlert,
  'status-fail': CircleX,
  'status-skip': CircleMinus,
  'device-physical': Smartphone,
  'device-virtual': MonitorSmartphone,
  android: Bot,
  ios: Apple,
  'eas-build': Cloud,
  'local-build': Laptop,
  latest: Clock,
  size: HardDrive,
  expiry: Hourglass,
  'eas-signed-in': CloudCheck,
  // The components ask for these two by name, for example in a selected
  // chip or a dialog with a close button.
  check: Check,
  close: X,
}

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export const iconResolver = createLucideResolver({ icons: ICONS })
