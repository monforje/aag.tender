import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SolarProvider } from '@solar-icons/react/lib/SolarProvider';
import { ToastProvider } from '@/shared/ui/Toast';
import { AppRouter } from './providers/router';
import './styles/global.css';

/** SolarProvider задаёт дефолты иконок (толщина 1.5) на уровне приложения.
 *  Фактический размер и цвет всё равно приходят из CSS (.icon / .icon svg) —
 *  так было в спрайте и так остаётся: числа живут в стилях, не в разметке.
 *
 *  ToastProvider монтируется рядом и ТОЖЕ один раз: вьюпорт тостов живёт
 *  поверх всего приложения, а useToast() работает из любого слоя ниже. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolarProvider strokeWidth={1.5}>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </SolarProvider>
  </StrictMode>,
);
