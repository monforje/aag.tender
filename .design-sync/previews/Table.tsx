import { Badge, Button, ROWS, STATUS, Table, tableCell } from 'clickup-shell';

/** Реестр как он есть на экране: модификаторы ячеек, статус капсулой, счётчик в caption.
    Данные и таблица статусов — настоящие, из entities/tender: один статус —
    один тон и один глиф во всех местах сразу. */
export const Registry = () => {
  const rows = ROWS.slice(0, 5);
  return (
    <Table caption={`Показано ${rows.length} из ${ROWS.length}`}>
      <thead>
        <tr>
          <th scope="col">№</th>
          <th scope="col">Название</th>
          <th scope="col">Портфель / проект</th>
          <th scope="col">Статус</th>
          <th scope="col">Срок сбора КП</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={tableCell.rowLink}>
            <td className={tableCell.mono}><span className={tableCell.link}>{row.id}</span></td>
            <td className={tableCell.strong}>{row.title}</td>
            <td>{row.portfolio}<span className={tableCell.sub}>{row.project}</span></td>
            <td>
              <Badge tone={STATUS[row.status].tone} icon={STATUS[row.status].icon}>
                {STATUS[row.status].label}
              </Badge>
            </td>
            <td className={tableCell.numeric}>{row.end}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

/** layout="fixed": колонки, которые СРАВНИВАЮТ, берут равную долю, а не ширину по содержимому. */
export const FixedColumns = () => (
  <Table layout="fixed" caption="Сравнение КП: колонки подрядчиков равны по ширине">
    <colgroup>
      <col style={{ width: 'clamp(180px, 34cqw, 320px)' }} />
      <col style={{ width: '22cqw' }} />
      <col style={{ width: '22cqw' }} />
      <col style={{ width: '22cqw' }} />
    </colgroup>
    <thead>
      <tr>
        <th scope="col">Позиция</th>
        <th scope="col">СтройМонтажСервис</th>
        <th scope="col">ГК «Высота»</th>
        <th scope="col">Ремстрой-Инжиниринг</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className={tableCell.strong} title="Устройство пароизоляции, м²">Устройство пароизоляции, м²</td>
        <td className={tableCell.numeric}>412 800</td>
        <td className={tableCell.numeric}>388 100</td>
        <td className={tableCell.numeric}>455 300</td>
      </tr>
      <tr>
        <td className={tableCell.strong} title="Укладка утеплителя 200 мм, м²">Укладка утеплителя 200 мм, м²</td>
        <td className={tableCell.numeric}>1 264 000</td>
        <td className={tableCell.numeric}>1 190 500</td>
        <td className={tableCell.numeric}>1 302 900</td>
      </tr>
      <tr>
        <td className={tableCell.strong} title="Наплавляемое покрытие в два слоя, м²">Наплавляемое покрытие в два слоя, м²</td>
        <td className={tableCell.numeric}>2 018 400</td>
        <td className={tableCell.numeric}>2 145 000</td>
        <td className={tableCell.numeric}>1 987 200</td>
      </tr>
    </tbody>
  </Table>
);

/** Пустой результат объясняет себя и даёт выход одним кликом. */
export const NoResults = () => (
  <Table caption="Показано 0 из 24">
    <thead>
      <tr>
        <th scope="col">№</th><th scope="col">Название</th><th scope="col">Статус</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className={tableCell.empty} colSpan={3}>
          Под фильтры не подошёл ни один тендер.
          <Button variant="secondary">Сбросить фильтры</Button>
        </td>
      </tr>
    </tbody>
  </Table>
);
