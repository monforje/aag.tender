import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/* Сборка дизайн-системы в library-mode — отдельным конфигом, потому что у
   приложения и у библиотеки разные входы и разный выход, а общего у них
   ровно то, что ниже дублируется намеренно: алиас '@' и настройки CSS-модулей.

   Почему нельзя отдать исходники напрямую сборщику дизайн-синка: классы в
   .module.css названы как в эталоне (.row__title), а в TSX читаются камелом
   (s.rowTitle) — это делает localsConvention. Кто соберёт модули без него,
   молча положит undefined вместо класса, и компоненты приедут без стилей.
   Поэтому дизайн-систему собирает ТОТ ЖЕ Vite, что и приложение.

   Что снаружи: только react — его дизайн-синк подменяет на window.React,
   чтобы в превью был один экземпляр. Роутер, zustand и иконки, наоборот,
   уезжают ВНУТРЬ бандла: второй экземпляр роутера сломал бы контекст. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[local]__[hash:base64:5]',
    },
  },
  build: {
    outDir: 'ds-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/ds-entry.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'],
    },
  },
});
