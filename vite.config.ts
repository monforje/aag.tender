import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  /* GitHub Pages отдаёт проект по подпути /aag.tender/, дев-сервер — с корня.
     Отсюда base зависит от команды, а не от переменной окружения: иначе о ней
     пришлось бы помнить и в CI, и при локальном `vite preview`.
     Роутер этот префикс уже читает — createBrowserRouter собран с
     basename: import.meta.env.BASE_URL, так что менять там нечего. */
  base: command === 'build' ? '/aag.tender/' : '/',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    modules: {
      // Классы в .module.css пишутся так же, как в исходном index.html
      // (.row__title, .is-active) — чтобы DevTools и DESIGN-NOTES.md совпадали.
      // В TSX они доступны в camelCase: s.rowTitle, s.isActive.
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[local]__[hash:base64:5]',
    },
  },
}));
