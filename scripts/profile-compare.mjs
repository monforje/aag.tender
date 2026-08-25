/* ПРОФИЛИРОВЩИК ЭКРАНА СРАВНЕНИЯ КП (puppeteer + CDP).
 *
 * КОГДА:  правка задела прокрутку ленты, липкую шапку, расчёт ширин колонок,
 *         пометки ячеек или панель «Анализ ИИ» — то есть всё, что описано в
 *         Частях XV–XVII DESIGN-NOTES.md. Числа получаются воспроизводимые,
 *         глазами эти регрессии не ловятся.
 * НЕ ДЛЯ: дев-сборки. React в dev держит StrictMode (двойной рендер) и
 *         неминифицированный код — числа завышены вдвое и врут о том, ЧТО
 *         оптимизировать.
 *
 * Разовая подготовка (в репозиторий пакет не кладём — он нужен раз в спринт):
 *   bun add -d puppeteer-core
 *
 * Прогон:
 *   bunx vite build --base=/          # base=/ обязателен: preview отдаёт с корня,
 *   bun run preview -- --port 4173    # а сборка по умолчанию собирается под /aag.tender/
 *   bun scripts/profile-compare.mjs http://localhost:4173/tenders/registry/T-2026-014 --cpu 4
 *
 * ЗАЧЕМ --cpu 4. На десктопе без троттлинга демо-смета (13 позиций × 6 КП)
 * не роняет ни одного кадра, и мерить нечего. Замедление в 4× показывает то
 * же, что покажет ноутбук на живой смете. Настоящие числа роста снимаются
 * раздутой фикстурой — она собирается отдельно и в репозитории не живёт.
 *
 * ЧТО ЧИТАТЬ. ScriptDuration — самая тихая метрика, ей верить в первую
 * очередь. Paint/Raster шумят ±30 % от прогона к прогону: считать выигрышем
 * только то, что повторилось в трёх запусках.
 */
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:4173/tenders/registry/T-2026-014';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CPU = Number(arg('--cpu', 4));
const CHROME = arg('--chrome', '/usr/bin/google-chrome');
const BAND = '[role="region"][aria-label^="Сравнение КП"]';
const M = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

const metrics = async () => {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(m.filter((x) => M.includes(x.name)).map((x) => [x.name, x.value]));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Кадры считаются в самой странице: rAF-таймстемпы — единственный источник,
   который видит пропущенный кадр так же, как его видит глаз. */
const frames = {
  start: () => page.evaluate(() => {
    window.__f = []; let last = performance.now();
    const tick = (t) => { window.__f.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
  }),
  stop: () => page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__f.slice(1).sort((a, b) => a - b);
    if (!f.length) return null;
    return { frames: f.length, p50: +f[f.length >> 1].toFixed(1),
             p95: +f[Math.floor(f.length * 0.95)].toFixed(1), max: +f[f.length - 1].toFixed(1),
             janky: f.filter((x) => x > 32).length };
  }),
};

async function scenario(name, fn) {
  await sleep(300);
  const a = await metrics();
  await frames.start();
  const t0 = Date.now();
  await fn();
  const wall = Date.now() - t0;
  const fr = await frames.stop();
  const b = await metrics();
  const d = Object.fromEntries(M.map((k) => [k, b[k] - a[k]]));
  const ms = (v) => (v * 1000).toFixed(0);
  console.log(`\n── ${name}  (${wall}ms)`);
  console.log(`   раскладка ×${d.LayoutCount} ${ms(d.LayoutDuration)}ms · стиль ×${d.RecalcStyleCount} ${ms(d.RecalcStyleDuration)}ms · скрипт ${ms(d.ScriptDuration)}ms · поток ${ms(d.TaskDuration)}ms`);
  if (fr) console.log(`   кадров ${fr.frames} · p50 ${fr.p50} p95 ${fr.p95} max ${fr.max} · пропущено>32ms ${fr.janky}`);
}

const nav0 = await metrics();
/* ЖДЁМ РАЗМЕТКУ, А НЕ ТИШИНУ В СЕТИ. `networkidle0` требует нуля соединений
   подряд полсекунды и на preview-сервере с keep-alive перестал наступать
   вовсе — прогон падал по таймауту, ничего не измерив. Ориентир здесь и так
   не сеть: настоящая готовность экрана это ЛЕНТА в DOM, её и ждём строкой
   ниже, а потом даём 1200 мс на доводку раскладки. */
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector(BAND, { timeout: 20000 });
await sleep(1200);
const nav1 = await metrics();
console.log(`\n── загрузка\n   раскладка ×${nav1.LayoutCount - nav0.LayoutCount} ${((nav1.LayoutDuration - nav0.LayoutDuration) * 1000).toFixed(0)}ms · стиль ×${nav1.RecalcStyleCount - nav0.RecalcStyleCount} ${((nav1.RecalcStyleDuration - nav0.RecalcStyleDuration) * 1000).toFixed(0)}ms · скрипт ${((nav1.ScriptDuration - nav0.ScriptDuration) * 1000).toFixed(0)}ms`);

const box = await (await page.$(BAND)).boundingBox();
const x = Math.round(box.x + box.width / 2);
const y = Math.round(box.y + Math.min(box.height / 2, 400));
await page.mouse.move(x, y);

/* Колесо шлём через CDP, а не page.mouse.wheel: нужен ровно один wheel-эвент
   на шаг — гейт «страница → лента» (useTableDock) слушает именно их. */
const wheel = async (n, dy, dx = 0) => {
  for (let i = 0; i < n; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy, pointerType: 'mouse' });
    await sleep(12);
  }
};

await scenario('колесо: гейт страница→лента (60×100px)', () => wheel(60, 100));
await scenario('колесо: лента вниз (60×100px)', () => wheel(60, 100));
await scenario('колесо: панорама вбок (60×80px)', () => wheel(60, 0, 80));
await scenario('колесо: вверх (80×−100px)', () => wheel(80, -100));

await scenario('ховер: проход по строкам (40 шагов)', async () => {
  for (let i = 0; i < 40; i++) { await page.mouse.move(x - 200 + (i % 8) * 60, y - 100 + (i % 5) * 34); await sleep(20); }
});

/* ── Сценарии новых фич (24.08.2026): матрица условий, тултипы названий,
   попапы ячеек. Элемент может отсутствовать на старых данных — сценарий
   тогда пропускается, а не падает. ── */

// Матрица условий внизу ленты: прыжки к концу и обратно.
const hasTerms = await page.evaluate(() => !!document.querySelector('[class*="terms-cap"]'));
if (hasTerms) {
  await scenario('условия: прыжки к матрице и назад ×5', async () => {
    for (let i = 0; i < 5; i++) {
      await page.evaluate((sel) => {
        const b = document.querySelector(sel);
        b.scrollTop = b.scrollHeight;
        void b.scrollTop;
        b.scrollTop = 0;
      }, BAND);
      await sleep(120);
    }
  });

  // Ховер по ответам матрицы: 450мс на ячейке — ровно порог показа попапа,
  // чтобы сценарий гонял цикл «показ → мост → сокрытие», а не только таймеры.
  await scenario('условия: ховер по ответам (6×450мс)', async () => {
    const cells = await page.$$('[class*="term-mark"], [class*="term-value"]');
    const n = Math.min(cells.length, 6);
    for (let i = 0; i < n; i++) {
      const box = await cells[i].boundingBox();
      if (!box) continue;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(450);
    }
    await page.mouse.move(x, y);
  });
}

// Тултипы названий: 450мс на ячейке-якоре — порог показа <Tooltip>.
await scenario('тултипы названий: ховер по якорю (5×450мс)', async () => {
  const rows = await page.$$('tbody th[class*="strong"]');
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const box = await rows[i].boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + 80, box.y + box.height / 2);
    await sleep(450);
  }
  await page.mouse.move(x, y);
});

// Попапы пометок ячеек: МИН/монета/аномалия — цикл показа на живых целях.
await scenario('попапы ячеек: ховер по пометкам (5×450мс)', async () => {
  const marks = await page.$$('[class*="tag"], [class*="coin"], [class*="anomaly-trigger"]');
  for (let i = 0; i < Math.min(marks.length, 5); i++) {
    const box = await marks[i].boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + Math.min(box.width / 2, 30), box.y + box.height / 2);
    await sleep(450);
  }
  await page.mouse.move(x, y);
});

/* Панель «Анализ ИИ» — единственная кнопка с парой aria-expanded/aria-controls;
   тогглы разделов несут только aria-expanded. */
const ai = await page.$('button[aria-controls][aria-expanded]');
if (ai) {
  await scenario('панель ИИ: открыть', async () => { await ai.click(); await sleep(1400); });
  await scenario('панель ИИ: закрыть', async () => { await ai.click(); await sleep(1400); });
}

const fold = await page.$$('button[aria-expanded]:not([aria-controls])');
if (fold.length) {
  await scenario('раздел: свернуть+развернуть ×3', async () => {
    for (let i = 0; i < 3; i++) { await fold[0].click(); await sleep(450); await fold[0].click(); await sleep(450); }
  });
}

/* ── СЦЕНАРИИ ВТОРОЙ ВОЛНЫ (25.08.2026) ────────────────────────────────────
   Обе новинки трогают то, что раньше не трогалось: тред открывает <dialog>
   поверх таблицы (верхний слой, свой стек), а галочка «Потенциал» ДОБАВЛЯЕТ
   КОЛОНКУ — то есть меняет colgroup, ширины и разметку всей ленты разом.
   Именно такие правки и роняют кадры незаметно. */
const thread = await page.$('[aria-label^="Комментарии"]');
if (thread) {
  await scenario('тред комментариев: открыть+закрыть ×20', async () => {
    for (let i = 0; i < 20; i++) {
      await thread.click();
      await sleep(60);
      await page.keyboard.press('Escape');
      await sleep(60);
    }
  });
}

/* Галочка «Потенциал» — кнопка-чип с aria-pressed и своей подписью. */
const potToggle = await page.$$eval('button[aria-pressed]', (els) => {
  const i = els.findIndex((e) => e.textContent.trim() === 'Потенциал');
  if (i >= 0) els[i].setAttribute('data-profile', 'pot');
  return i;
});
if (potToggle >= 0) {
  const pot = await page.$('button[data-profile="pot"]');
  await scenario('колонка «Потенциал»: включить+выключить ×10', async () => {
    for (let i = 0; i < 10; i++) {
      await pot.click();
      await sleep(120);
      await pot.click();
      await sleep(120);
    }
  });
}

await scenario('resize окна: 1600→1100→1600', async () => {
  for (const w of [1500, 1350, 1200, 1100, 1350, 1600]) {
    await page.setViewport({ width: w, height: 900 });
    await sleep(260);
  }
});

await browser.close();
