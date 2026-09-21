import type { Preview } from '@storybook/react-vite';
import '@/styles/index.scss';
import { Angustia } from '../src/ui/theme/Angustia/Angustia';
import { backgrounds, viewports } from '../src/ui/theme/Angustia/preview';

const preview: Preview = {
  parameters: {
    // Solo las superficies del sistema; Angustia es dark-only y no ofrece fondo claro.
    backgrounds: {
      options: backgrounds,
    },
    viewport: {
      options: viewports,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
    docs: {
      theme: Angustia,
    },
  },

  //Fondo inicial; se puede cambiar desde la barra de herramientas
  initialGlobals: {
    backgrounds: { value: 'canvas' },
  },
};

export default preview;
