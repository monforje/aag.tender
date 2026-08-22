import { useState } from 'react';
import { Pagination, Stack, Text } from 'clickup-shell';

/** Окно страниц с краями и многоточием. */
export const Middle = () => {
  const [page, setPage] = useState(7);
  return (
    <Stack gap={2}>
      <Text size="sm" tone="secondary">Страница {page} из 24</Text>
      <Pagination page={page} pageCount={24} onPageChange={setPage} />
    </Stack>
  );
};

/** У краёв многоточие только с одной стороны. */
export const Edges = () => (
  <Stack gap={4}>
    <Pagination page={1} pageCount={12} onPageChange={() => {}} />
    <Pagination page={12} pageCount={12} onPageChange={() => {}} />
  </Stack>
);

/** Одна страница — компонент исчезает сам, места под себя не занимает. */
export const Hidden = () => (
  <Stack gap={2}>
    <Text size="sm" tone="secondary">pageCount = 1 — ниже ничего не нарисовано, и это правильно</Text>
    <Pagination page={1} pageCount={1} onPageChange={() => {}} />
  </Stack>
);
