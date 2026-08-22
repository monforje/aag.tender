export {
  Kbd, RequiredMark, Dot, TruncatedText,
} from './Text';
export { StatusDot, Delta, NumericText, AvatarGroup } from './Data';
export type { DeltaProps } from './Data';
export { CopyButton, CloseButton, MoreButton } from './Controls';
export type { CopyButtonProps, CloseButtonProps, MoreButtonProps } from './Controls';

/* СЛОЙ МИКРО-КОМПОНЕНТОВ — ступень между токенами и примитивами shared/ui:
   Token → Micro → Component → Pattern → Page.

   Почему одним семейным слайсом (как Page и Layout), а не одиннадцатью
   папками в корне shared/ui: каждый компонент здесь размером с проп, и
   одиннадцать index.ts к ним стоили бы дороже самих компонентов. Публичная
   точка одна — @/shared/ui/Micro; CSS разбит на три модуля по природе
   (текст, данные, контролы), а не по файлам.

   Правило включения: микро попадает сюда, когда у него ЕСТЬ потребитель
   среди компонентов выше или он явно заказан. Чего здесь НЕТ и почему:
     DragHandle / Grip / ResizeHandle — нет ни одного перетаскивания;
     Code / MonoText — моноширинного токена в системе нет, заводить его
       надо в шкале, а не в компоненте;
     Pill / Tag / StatusLabel — это <Badge>, второй капсулы быть не должно;
     NotificationDot / OnlineIndicator — <Counter> и точка online у <Avatar>;
     FieldHint / FieldError — подсказка и ошибка уже живут внутри <Field>,
       наружу их отдаёт контекст поля.

   Композиция важнее размножения: «значение + копирование» — это
   <Inline gap={1}><NumericText/>…<CopyButton/></Inline>, а не новый
   CopyableText на каждую пару. */
