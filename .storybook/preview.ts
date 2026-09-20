import type { Preview } from '@storybook/react-vite';
import '@/styles/index.scss';
import { Angustia } from '../src/ui/theme/Angustia/Angustia';

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        light: { name: 'Light', value: '#ffffff' },
        dark: { name: 'Dark', value: '#1a1a1a' },
      },
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
    backgrounds: { value: 'dark' },
  },
};

export default preview;
