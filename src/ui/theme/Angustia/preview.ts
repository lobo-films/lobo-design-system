import type { ViewportMap } from 'storybook/viewport';
import breakpoints from './breakpoints.module.scss';

// Parámetros del canvas de Storybook para el tema Angustia: fondos y viewports.

// El manager pinta la muestra de color fuera del iframe, donde las custom
// properties del preview no existen, así que los fondos son literales con el
// token de origen anotado, igual que en `Angustia.ts` (ADR 0010 §2.11).
export const backgrounds = {
  canvas: { name: 'Canvas', value: '#080A0F' /* --bg-canvas */ },
  surface: { name: 'Surface', value: '#10141B' /* --bg-surface */ },
  elevated: { name: 'Elevated', value: '#1D222B' /* --bg-elevated */ },
};

function breakpoint(name: string): string {
  const value = breakpoints[name];
  if (!value) {
    throw new Error(`Breakpoint \`${name}\` inexistente en tokens/_breakpoints.scss.`);
  }
  return value;
}

// Los anchos de banda salen de `tokens/_breakpoints.scss` vía
// `breakpoints.module.scss`. Las alturas no son tokens: son proporciones de
// dispositivo convencionales que solo dan forma al marco del iframe.
export const viewports: ViewportMap = {
  mobile: {
    name: 'Mobile · 320',
    styles: { width: breakpoint('mobile'), height: '568px' },
    type: 'mobile',
  },
  tablet: {
    name: 'Tablet · 768',
    styles: { width: breakpoint('tablet'), height: '1024px' },
    type: 'tablet',
  },
  desktop: {
    name: 'Desktop · 1024',
    styles: { width: breakpoint('desktop'), height: '768px' },
    type: 'desktop',
  },
  // Excepción declarada: `--screen-width` es una custom property y no hay forma
  // de leerla en el contexto de configuración de Storybook sin un documento. Se
  // copia el literal y se anota su origen. No es un breakpoint: no se añade al
  // mapa `$breakpoints`.
  screen: {
    name: 'Referencia · 1440',
    styles: { width: '1440px' /* --screen-width */, height: '900px' },
    type: 'desktop',
  },
};
