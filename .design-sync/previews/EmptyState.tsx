import { Button, EmptyState } from 'clickup-shell';

/** Выборка ничего не нашла: сказать почему и дать выход одним кликом. */
export const NoResults = () => (
  <EmptyState
    icon="search"
    title="Под фильтры не подошёл ни один тендер"
    description="Сняты не все критерии: вид работ «Проектирование» и период с 01.01 по 31.03."
    action={<Button variant="secondary">Сбросить фильтры</Button>}
  />
);

/** Раздел ждёт первых данных — приглашение, а не извинение. */
export const NothingYet = () => (
  <EmptyState
    icon="documentText"
    title="Коммерческих предложений пока нет"
    description="Как только подрядчики пришлют КП, они появятся здесь и встанут в сравнение."
    action={<Button variant="primary">Пригласить подрядчика</Button>}
  />
);

/** Без действия: бывает, что выхода нет и честнее не рисовать кнопку. */
export const Informational = () => (
  <EmptyState
    icon="inbox"
    title="Архив пуст"
    description="Тендеры попадают сюда через год после закрытия."
    tone="neutral"
  />
);
