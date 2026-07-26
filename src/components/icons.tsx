// Clean, simple icon set via lucide-react (bundled — works offline, no CDN).
// We alias to app-specific names so screens read clearly and we can swap sets
// in one place. Also exposes a registry for user-pickable icons (Event Status).
import {
  Home,
  CalendarDays,
  Ticket,
  ListChecks,
  Wallet,
  LayoutGrid,
  Plus,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Bell,
  Settings,
  Trash2,
  Pencil,
  ArrowRight,
  Heart,
  Sun,
  Moon,
  Minus,
  Compass,
  Tag,
  Link2,
  Lock,
  LockOpen,
  Repeat,
  MapPin,
  Users,
  Search,
  TrendingUp,
  FileClock,
  BadgeCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Circle,
  PlayCircle,
  PauseCircle,
  Eye,
  CircleDollarSign,
  Receipt,
  ClipboardList,
  Filter,
  Armchair,
  Move,
  type LucideIcon,
} from "lucide-react";

// ---- Navigation / UI ----
export const IconHome = Home;
export const IconCalendar = CalendarDays;
export const IconEvents = Ticket;
export const IconTasks = ListChecks;
export const IconBudget = Wallet;
export const IconGrid = LayoutGrid;
export const IconPlus = Plus;
export const IconCheck = Check;
export const IconChevron = ChevronRight;
export const IconChevronLeft = ChevronLeft;
export const IconClose = X;
export const IconBell = Bell;
export const IconSettings = Settings;
export const IconLink = Link2;
export const IconLock = Lock;
export const IconUnlock = LockOpen;
export const IconCompass = Compass;
export const IconTag = Tag;
export const IconTrash = Trash2;
export const IconEdit = Pencil;
export const IconArrowRight = ArrowRight;
export const IconHeart = Heart;
export const IconSun = Sun;
export const IconMoon = Moon;
export const IconMinus = Minus;
export const IconRepeat = Repeat;
export const IconPin = MapPin;
export const IconOwners = Users;
export const IconGuests = Users;
export const IconSearch = Search;
export const IconDollar = CircleDollarSign;
export const IconReceipt = Receipt;
export const IconClipboard = ClipboardList;
export const IconFilter = Filter;
export const IconSeat = Armchair;
export const IconMove = Move;

// ---- Event/Task status icons ----
export const IconTrendingUp = TrendingUp;
export const IconFileClock = FileClock;
export const IconBadgeCheck = BadgeCheck;
export const IconZap = Zap;
export const IconCheckCircle = CheckCircle2;
export const IconXCircle = XCircle;
export const IconCircle = Circle;
export const IconPlayCircle = PlayCircle;
export const IconPauseCircle = PauseCircle;
export const IconEye = Eye;

// ---- Registry for user-pickable icons (Event Status Setup list) ----
export const NAMED_ICONS: Record<string, LucideIcon> = {
  "trending-up": TrendingUp,
  "file-clock": FileClock,
  "badge-check": BadgeCheck,
  zap: Zap,
  "check-circle-2": CheckCircle2,
  "x-circle": XCircle,
  circle: Circle,
  "play-circle": PlayCircle,
  "pause-circle": PauseCircle,
  eye: Eye,
  star: Sun,
  heart: Heart,
};

export const PICKABLE_ICON_NAMES = Object.keys(NAMED_ICONS);

export function Icon({ name, ...p }: { name: string } & React.ComponentProps<LucideIcon>) {
  const Cmp = NAMED_ICONS[name] ?? Circle;
  return <Cmp {...p} />;
}
