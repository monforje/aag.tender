/* Таблица соответствия: id символа из спрайта reference/index.html → компонент.
   Составлена машинно — сопоставлением геометрии путей, а не имён: у Solar другие
   названия (search→Magnifier, myTasks→Checklist, grid→Widget5, activity→Pulse).
   35 из 39 символов совпали с пакетом побайтово; 4 (docs/funnel/target/planet —
   прежние иконки рейла) в Solar отсутствуют и живут в ./local-icons.tsx с теми
   же путями; сегодня не используются, сохранены для паритета со спрайтом.
   Толщина 1.5 и размер задаются CSS (.icon svg в Icon.module.css), а не пропами —
   так же, как было со спрайтом (§3). */
import type { ComponentType, SVGProps } from 'react';

/** Общий контракт: и Solar-компонент, и локальный принимают пропсы <svg>. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
import { AddCircleIcon } from '@solar-icons/react/linear/add-circle';
import { AltArrowDownIcon as AltArrowDownBoldIcon } from '@solar-icons/react/bold/alt-arrow-down';
import { StarIcon as StarBoldIcon } from '@solar-icons/react/bold/star';
import { AltArrowDownIcon } from '@solar-icons/react/linear/alt-arrow-down';
import { ArrowRightUpIcon } from '@solar-icons/react/linear/arrow-right-up';
import { ArrowUpIcon } from '@solar-icons/react/linear/arrow-up';
import { BellIcon } from '@solar-icons/react/linear/bell';
import { BillListIcon } from '@solar-icons/react/linear/bill-list';
import { Book2Icon } from '@solar-icons/react/linear/book-2';
import { Buildings2Icon } from '@solar-icons/react/linear/buildings-2';
import { CalendarIcon } from '@solar-icons/react/linear/calendar';
import { CalendarMinimalisticIcon } from '@solar-icons/react/linear/calendar-minimalistic';
import { ChatRoundIcon } from '@solar-icons/react/linear/chat-round';
import { ChatSquareArrowIcon } from '@solar-icons/react/linear/chat-square-arrow';
import { CheckCircleIcon } from '@solar-icons/react/linear/check-circle';
import { ChecklistIcon } from '@solar-icons/react/linear/checklist';
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list';
import { ClockCircleIcon } from '@solar-icons/react/linear/clock-circle';
import { CloseCircleIcon } from '@solar-icons/react/linear/close-circle';
import { DoubleAltArrowLeftIcon } from '@solar-icons/react/linear/double-alt-arrow-left';
import { DoubleAltArrowRightIcon } from '@solar-icons/react/linear/double-alt-arrow-right';
import { DocumentTextIcon } from '@solar-icons/react/linear/document-text';
import { FilterIcon } from '@solar-icons/react/linear/filter';
import { FlagIcon } from '@solar-icons/react/linear/flag';
import { GraphUpIcon } from '@solar-icons/react/linear/graph-up';
import { HashtagIcon } from '@solar-icons/react/linear/hashtag';
import { HomeIcon } from '@solar-icons/react/linear/home';
import { InboxIcon } from '@solar-icons/react/linear/inbox';
import { LayersIcon } from '@solar-icons/react/linear/layers';
import { LetterIcon } from '@solar-icons/react/linear/letter';
import { ListIcon } from '@solar-icons/react/linear/list';
import { MagnifierIcon } from '@solar-icons/react/linear/magnifier';
import { MedalStarIcon } from '@solar-icons/react/linear/medal-star';
import { MenuDotsIcon } from '@solar-icons/react/linear/menu-dots';
import { PipetteIcon } from '@solar-icons/react/linear/pipette';
import { PulseIcon } from '@solar-icons/react/linear/pulse';
import { ReplyIcon } from '@solar-icons/react/linear/reply';
import { ScaleIcon } from '@solar-icons/react/linear/scale';
import { ScannerIcon } from '@solar-icons/react/linear/scanner';
import { SettingsIcon } from '@solar-icons/react/linear/settings';
import { ShareIcon } from '@solar-icons/react/linear/share';
import { SidebarIcon } from '@solar-icons/react/linear/sidebar';
import { SledgehammerIcon } from '@solar-icons/react/linear/sledgehammer';
import { Palette2Icon } from '@solar-icons/react/linear/palette-2';
import { SliderHorizontalIcon } from '@solar-icons/react/linear/slider-horizontal';
import { StarIcon } from '@solar-icons/react/linear/star';
import { StarsIcon } from '@solar-icons/react/linear/stars';
import { UserIcon } from '@solar-icons/react/linear/user';
import { UserPlusIcon } from '@solar-icons/react/linear/user-plus';
import { VideocameraIcon } from '@solar-icons/react/linear/videocamera';
import { Widget5Icon } from '@solar-icons/react/linear/widget-5';
import { DocsIcon, FunnelIcon, PlanetIcon, TargetIcon } from './local-icons';

export const ICONS = {
  home: HomeIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  calendar: CalendarIcon,
  ai: StarsIcon,
  grid: Widget5Icon,   // не используется сегодня, оставлен для паритета со спрайтом
  userPlus: UserPlusIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  arrowUp: ArrowUpIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  closeRight: DoubleAltArrowRightIcon,
  closeLeft: DoubleAltArrowLeftIcon,
  chevronDown: AltArrowDownIcon,
  caretSmall: AltArrowDownIcon,
  altArrowDownBold: AltArrowDownBoldIcon,
  search: MagnifierIcon,
  bell: BellIcon,
  calendarSm: CalendarMinimalisticIcon,
  inbox: InboxIcon,
  reply: ReplyIcon,
  assigned: ChatSquareArrowIcon,
  skill: MedalStarIcon,
  video: VideocameraIcon,
  myTasks: ChecklistIcon,
  ellipsis: MenuDotsIcon,
  add: AddCircleIcon,
  /* Настоящий крестик. Раньше его роль играл add, повёрнутый на 45°, — в
     СПРАЙТЕ эталона крестика нет. Но экраны вне эталона рисуются иконками
     Solar напрямую, а там он есть; поворот держался в трёх модулях сразу
     (статус «Отменён», очистка поиска, «Сбросить всё») и всякий раз требовал
     объяснения. */
  closeCircle: CloseCircleIcon,
  filter: FilterIcon,
  list: ListIcon,
  sparkleChat: ChatRoundIcon,
  hash: HashtagIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  settings: SettingsIcon,
  sliders: SliderHorizontalIcon,
  clock: ClockCircleIcon,
  activity: PulseIcon,
  share: ShareIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  person: UserIcon,
  panelLeft: SidebarIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  layers: LayersIcon,
  checkCircle: CheckCircleIcon,
  docs: DocsIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  funnel: FunnelIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  target: TargetIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  planet: PlanetIcon,   // не используется сегодня, оставлен для паритета со спрайтом
  documentText: DocumentTextIcon,
  book2: Book2Icon,
  clipboardList: ClipboardListIcon,
  billList: BillListIcon,
  scanner: ScannerIcon,
  letter: LetterIcon,
  graphUp: GraphUpIcon,
  scale: ScaleIcon,
  /* Поля шапки карточки тендера. В СПРАЙТЕ эталона их не было и быть не могло
     — эталон не знал про тендеры; экраны вне эталона берут иконки из Solar
     напрямую (то же основание, что у closeCircle). Подобраны по значению
     поля, а не по красоте: объект — здания, статус — флаг, вид работ —
     инструмент. */
  buildings2: Buildings2Icon,
  flag: FlagIcon,
  sledgehammer: SledgehammerIcon,
  /* Сравнение КП. Звезда идёт ПАРОЙ — контур и заливка: «в избранном» это
     состояние, а состояние в этом интерфейсе не кодируется одним лишь цветом
     (см. правило <Badge>). Контур → заливка меняет саму ФОРМУ знака, и отметку
     видно в чёрно-белой печати и при дальтонизме. */
  star: StarIcon,
  starFilled: StarBoldIcon,
  /* Пипетка «взять цвет с экрана» в <ColorPicker>. Показывается только там,
     где платформа умеет EyeDropper. */
  pipette: PipetteIcon,
  /* Палитра художника с четырьмя каплями краски (solar:palette-2-linear),
     а не solar:palette: та рисует КИСТЬ над лотком и читается как
     «рисовать», тогда как здесь ВЫБИРАЮТ цвет из готового набора. */
  palette: Palette2Icon,
  /* «Открыть досье» — диагональная стрелка, а не шеврон: шеврон в этом
     интерфейсе означает раскрытие НА МЕСТЕ (дерево, разделы сметы,
     свёртывание карточек), а здесь уход в отдельное окно. */
  arrowRightUp: ArrowRightUpIcon,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;
