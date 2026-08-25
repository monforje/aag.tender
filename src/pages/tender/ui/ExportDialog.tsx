import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import {
  currentVersion, EXPORT_CONTENT, exportFileName, exportVersionsLine,
  requestExport, type Contractor,
} from '@/entities/comparison';
import { plural } from '@/shared/lib/plural';
import s from './ExportDialog.module.css';

/**
 * Выгрузка сравнения в .xlsx (§5.8, `table.md` §7).
 *
 * КОГДА:  кнопка «Выгрузить .xlsx» в правом блоке полосы сравнения.
 * НЕ ДЛЯ: печати экрана и копирования ссылки на срез (§3.5) — там передают
 *         ВИД, здесь ДАННЫЕ, и составы у них принципиально разные.
 *
 * UX:     СОСТАВ ФАЙЛА ВСЕГДА ПОЛНЫЙ, и чеклист его ПОКАЗЫВАЕТ, а не
 *         набирает: галочки здесь читаются, а не ставятся. Выгрузка — это
 *         документ к раунду, а не снимок чьего-то экрана; половина сметы в
 *         приложении к протоколу читалась бы потерей данных. Фильтры и
 *         «Показано» уезжают в метаданные листа, а не режут строки.
 *         ГАЛОЧКИ СПРАВА ПРИ РОВНОМ ЛЕВОМ КРАЕ ТЕКСТА (правило владельца
 *         25.08.2026): тот же порядок, что в меню сортировки, фильтров и
 *         версий — читают текст, а отмечают состояние.
 *         ВЕРСИИ ФИКСИРУЮТСЯ ИМЕНЕМ: строка чеклиста называет, чьи именно
 *         версии попадут в файл, — иначе через неделю не доказать, какое
 *         предложение сравнивали.
 *         ДВЕ КНОПКИ 50/50 (правка владельца).
 * A11Y:   окно на нативном `<dialog>` (см. <Modal>); имя файла — не картинка,
 *         а текст, его можно выделить и скопировать до выгрузки.
 *
 * @example
 * <ExportDialog open={open} onClose={close} tenderId="T-2026-050"
 *               contractors={contractors} rows={65} />
 */
export function ExportDialog({ open, onClose, tenderId, contractors, rows }: {
  open: boolean;
  onClose: () => void;
  tenderId: string;
  contractors: Contractor[];
  rows: number;
}) {
  const picked = contractors
    .map((c) => ({ name: c.name, version: currentVersion(c)?.label }))
    .filter((v): v is { name: string; version: string } => !!v.version);
  const versionsLine = exportVersionsLine(picked);
  const fileName = exportFileName(tenderId);

  return (
    <Modal open={open} onClose={onClose} label="Выгрузка сравнения" className={s.dialog}>
      <h4 className={s.title}>Выгрузка сравнения</h4>
      <p className={s.sub}>
        Тендер {tenderId} · {rows} {plural(rows, 'позиция', 'позиции', 'позиций')} ·{' '}
        {contractors.length} {plural(contractors.length, 'поставщик', 'поставщика', 'поставщиков')}
      </p>

      <div className={s.checklist}>
        {[...EXPORT_CONTENT, ...(versionsLine ? [versionsLine] : [])].map((line) => (
          <p key={line} className={s.checkLine}>
            <span className={s.grow}>{line}</span>
            <Icon name="checkCircle" className={s.checkIcon} />
          </p>
        ))}
      </div>

      <p className={s.fileName}>{fileName}</p>

      {/* ГЕНЕРАЦИЯ — СЕРВЕРНАЯ, и это сказано честно (см. export.api.ts):
          в файл обязаны попасть типы ячеек, группировка строк из свёртки и
          сохранённая подсветка — возможности формата, а не разметки. Пока
          эндпоинта нет, кнопка задание ПРИНИМАЕТ и говорит, что файл
          готовится; подсовывать вместо .xlsx переименованный CSV значило бы
          отдать пользователю сломанный документ. */}
      <div className={s.actions}>
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button
          variant="primary"
          onClick={async () => {
            await requestExport({
              tenderId,
              versions: contractors.map((c) => ({
                contractorId: c.id, versionId: currentVersion(c)?.id ?? '',
              })),
            });
            onClose();
          }}
        >
          <Icon name="download" className={s.btnIcon} />
          Выгрузить
        </Button>
      </div>
    </Modal>
  );
}
