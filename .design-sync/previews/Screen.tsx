import { Badge, PageHeader, PageTitle, Screen, Table, tableCell, ROWS, STATUS } from 'clickup-shell';
/** Обвязка страницы: колонка контента 12px от левого края main. */
export const Registry = () => (
  <Screen>
    <PageHeader><PageTitle>Реестр тендеров</PageTitle></PageHeader>
    <Table caption={`Показано 3 из ${ROWS.length}`}>
      <thead><tr><th scope="col">№</th><th scope="col">Название</th><th scope="col">Статус</th></tr></thead>
      <tbody>
        {ROWS.slice(0, 3).map((r) => (
          <tr key={r.id}>
            <td className={tableCell.mono}>{r.id}</td>
            <td className={tableCell.strong}>{r.title}</td>
            <td><Badge tone={STATUS[r.status].tone} icon={STATUS[r.status].icon}>{STATUS[r.status].label}</Badge></td>
          </tr>
        ))}
      </tbody>
    </Table>
  </Screen>
);
