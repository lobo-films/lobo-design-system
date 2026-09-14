# Estructura de `src/`

Documentación de referencia rápida de la organización de directorios de Lobo
Design System (LDS). Para el razonamiento y las decisiones detrás de esta
estructura, ver
[`0004-project-structure.md`](../docs/adr/0004-project-structure.md).

```
src/
├── ui/
│   ├── base/
│   ├── composed/
│   ├── layouts/
│   ├── shared/
│   │   ├── hooks/
│   │   └── utils/
│   └── index.ts
│
├── styles/
│   ├── tokens/
│   ├── abstracts/
│   ├── theme/
│   ├── base/
│   └── main.scss
│
└── assets/
    ├── images/
    ├── icons/
    └── fonts/
```

## `ui/`

Componentes React del design system.

| Carpeta         | Contenido                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `base/`         | Primitivas visuales sin composición interna ni estado propio (Button, Text, Input, Icon, Badge) |
| `composed/`     | Componentes con composición de primitivas y/o estado propio (Card, Form, Nav)                   |
| `layouts/`      | Primitivas de estructura y espaciado (Grid, Stack, Container, Section, Article)                 |
| `shared/hooks/` | Hooks reutilizados por más de un componente (`useMediaQuery`, `useControllableState`)           |
| `shared/utils/` | Funciones puras reutilizadas por más de un componente (`cn()`, `mergeRefs`)                     |
| `index.ts`      | Barrel export público — define la API expuesta a consumidores del paquete                       |

### Anatomía de un componente

```
ui/base/Button/
├── hooks/              [Opcional] Hooks internos, no exportados fuera del componente
├── components/         [Opcional] Subcomponentes de soporte, no consumibles de forma independiente
├── assets/             [Opcional] Recursos exclusivos de este componente
├── Button.tsx           Implementación
├── Button.scss          Estilos BEM
├── Button.stories.tsx   Casos de uso en Storybook
├── Button.test.tsx      Pruebas
└── index.ts             Export público del componente
```

Las carpetas opcionales solo se crean cuando el componente las necesita — no se
generan de forma preventiva.

## `styles/`

Estilos globales y compartidos entre componentes. Estilos específicos de un
componente individual viven colocalizados en `ui/`, no aquí.

| Carpeta      | Contenido                                                                   |
| ------------ | --------------------------------------------------------------------------- |
| `tokens/`    | Valores de diseño: color, spacing, tipografía, breakpoints                  |
| `abstracts/` | Mixins, funciones y placeholders SCSS que consumen los valores de `tokens/` |
| `theme/`     | Composición del tema visual del sistema                                     |
| `base/`      | Reset/normalize, defaults de elementos HTML, tipografía base                |
| `main.scss`  | Punto de entrada — centraliza todo vía `@use`                               |

## `assets/`

Recursos estáticos de uso general en el sistema (no exclusivos de un
componente).

| Carpeta   | Contenido               |
| --------- | ----------------------- |
| `images/` | Imágenes de uso general |
| `icons/`  | Iconografía SVG         |
| `fonts/`  | Fuentes tipográficas    |

## Convenciones

- **Casing:** todo el árbol en minúsculas, salvo el nombre propio del componente
  (`Button/`, `Button.tsx`).
- **Nomenclatura BEM:** todo componente usa un prefijo de namespace en su bloque
  raíz para evitar colisión de clases (`.lds-button`, `.lds-card`).
- **Promoción a `shared/`:** un hook o util nace dentro del componente que lo
  necesita. Se promueve a `ui/shared/` solo cuando un segundo componente, sin
  relación de dependencia con el primero, requiere la misma lógica.
