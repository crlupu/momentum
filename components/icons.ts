/**
 * The app's icons, in one place.
 *
 * Google's Material set, taken as React components rather than as the Material
 * Symbols font: a font would have to be fetched before anything could be drawn,
 * and until it arrived every button would show the ligature's raw text. These
 * are inlined SVG, so they are there on first paint and offline.
 *
 * Exported under the names the app already used, so a change of icon set is a
 * change to this file rather than to every component. Where Material has no
 * equivalent the nearest one stands in — an apple becomes cutlery, a dumbbell
 * becomes a gym.
 *
 * One thing to know when adding to this list: these icons are drawn as filled
 * paths, where the previous set was drawn as strokes. Any rule that colours an
 * icon has to set `fill`, not `stroke`, or the icon is there but invisible.
 */
export {
  // actions
  MdAdd as Plus,
  MdCheck as Check,
  MdClose as X,
  MdEdit as Pencil,
  MdDeleteOutline as Trash2,
  MdContentCopy as Copy,
  MdRestore as RotateCcw,
  MdPlaylistAdd as ListPlus,
  MdPlayArrow as Play,
  MdSettings as Settings,
  MdPalette as Palette,
  MdCheckCircle as CheckCircle2,
  MdPushPin as Pin,
  MdOutlinePushPin as PinOff,
  MdImageNotSupported as ImageOff,
  MdCalendarToday as CalendarDays,

  // direction
  MdArrowUpward as ArrowUp,
  MdArrowDownward as ArrowDown,
  MdKeyboardArrowDown as ChevronDown,
  MdKeyboardArrowRight as ChevronRight,

  // navigation and sections
  MdMenu as Menu,
  MdTrackChanges as Target,
  MdRepeat as Repeat,
  MdFitnessCenter as Dumbbell,
  MdRestaurant as Apple,
  MdMenuBook as BookOpen,
  MdBarChart as BarChart3,
  MdReceiptLong as ScrollText,
  MdLogout as LogOut,

  // theme
  MdLightMode as Sun,
  MdDarkMode as Moon,
} from "react-icons/md";
