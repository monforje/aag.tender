import { contentFor, Flyout } from 'clickup-shell';
/** Превью раздела при наведении на рейл: то же дерево, что в панели. */
export const Tenders = () => (
  /* Флайаут — position: fixed относительно рейла. В карточке рейла нет,
     поэтому контейнер получает transform: он делает из себя containing block,
     и панель встаёт внутри карточки, а не улетает к краю вьюпорта. */
  <div style={{ height: 420, width: 340, transform: 'translateZ(0)' }}>
    <Flyout
      openId="tenders"
      noAnimation
      items={contentFor('tenders')}
      activePath="/tenders/registry"
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
    />
  </div>
);
