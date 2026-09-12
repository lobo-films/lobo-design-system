# 0004 — Estructura de directorios del proyecto (LDS)

## Estado

Aceptado

## Contexto

Lobo Design System (LDS) es un paquete de componentes puro — no incluye capa de aplicación, estado global de negocio, ni servicios. Se distribuye como dependencia consumida por proyectos de Lobo Films.

Antes de escalar el número de componentes, era necesario fijar una estructura de directorios que resolviera explícitamente:

- Separación entre primitivas visuales, componentes compuestos y primitivas de layout.
- Ubicación de estilos compartidos (tokens, theming, resets) frente a estilos de componente individual.
- Reutilización de lógica (hooks, utilidades) entre componentes sin acoplar componentes entre sí.
- Convenciones de nomenclatura que se mantengan estables en entornos con distinta sensibilidad a mayúsculas/minúsculas (CI en Linux vs. desarrollo local en macOS/Windows).

El stack de estilos definido es SCSS con metodología BEM (ver `0001-stack-versions.md` para versiones de herramientas). BEM no provee aislamiento automático de clases — el scoping es responsabilidad de la convención de nomenclatura, no del compilador.

## Decisión

Se adopta la siguiente estructura de directorios:

```
src/                                    Directorio raíz del design system
│
├── ui/                                 Componentes React (JSX/TSX)
│   │
│   ├── base/                           Primitivas visuales sin composición interna
│   │                                   (Button, Text, Input, Icon, Badge)
│   │
│   ├── composed/                       Componentes con composición de primitivas
│   │                                   y/o estado propio (Card, Form, Nav)
│   │
│   ├── layouts/                        Primitivas de estructura y espaciado
│   │                                   (Grid, Stack, Container, Section, Article)
│   │
│   ├── shared/                         Lógica transversal reutilizable entre
│   │   │                               componentes (no exportada como UI pública)
│   │   ├── hooks/                      Hooks compartidos
│   │   │                               (useMediaQuery, useControllableState)
│   │   └── utils/                      Funciones puras compartidas
│   │                                   (cn(), mergeRefs)
│   │
│   └── index.ts                        Barrel export público del design system
│
│   └── base/Button/                    Ejemplo de anatomía de componente
│       ├── hooks/                      [Opcional] Hooks internos, no exportados
│       │                               fuera del componente
│       ├── components/                 [Opcional] Subcomponentes de soporte
│       │                               (no consumibles de forma independiente)
│       ├── assets/                     [Opcional] Recursos exclusivos del
│       │                               componente (no compartidos)
│       ├── Button.tsx                  Implementación del componente
│       ├── Button.scss                 Estilos BEM del componente
│       ├── Button.stories.tsx          Casos de uso en Storybook
│       ├── Button.test.tsx             Pruebas unitarias/integración
│       └── index.ts                    Export público del componente
│                                       (define la API expuesta al consumidor)
│
├── styles/                             Estilos globales y compartidos
│   ├── tokens/                         Valores de diseño (color, spacing,
│   │                                   tipografía, breakpoints) — build-time
│   ├── abstracts/                      Comportamiento SCSS: mixins, funciones,
│   │                                   placeholders (consumen valores de tokens/)
│   ├── theme/                          Composición del tema visual del sistema
│   ├── base/                           Reset/normalize, defaults de elementos
│   │                                   HTML, tipografía base
│   └── main.scss                       Punto de entrada — centraliza todo
│                                       vía @use
│
└── assets/                             Recursos estáticos globales
    ├── images/                         Imágenes de uso general del sistema
    ├── icons/                          Iconografía SVG del sistema
    └── fonts/                          Fuentes tipográficas del proyecto
```

### Reglas de clasificación

**`base/` vs. `composed/`.** El criterio es composición interna y estado, no complejidad visual. Un componente sin subcomponentes internos y sin estado propio es `base/`, independientemente del número de variantes de estilo que exponga.

**`layouts/`.** Componentes de estructura y espaciado (Grid, Stack, Container, Section, Article) no encajan en `base/` (no son primitivas visuales) ni en `composed/` (no tienen estado ni lógica de negocio). Se mantienen en directorio propio.

**`tokens/` vs. `abstracts/`.** Separación entre dato y comportamiento. `tokens/` contiene valores puros — single source of truth de diseño. `abstracts/` contiene la lógica que opera sobre esos valores (mixins de breakpoints, funciones de conversión de unidades). Un mismo archivo no debe mezclar ambas responsabilidades.

**`ui/shared/` — regla de frontera y promoción.** Distinto de `Button/hooks/` (privado, no reutilizable fuera de `Button`), `shared/` resuelve reutilización *entre* componentes. Regla de promoción: un hook o util nace dentro del componente que lo necesita; se promueve a `shared/` únicamente cuando un segundo componente requiere la misma lógica sin relación de dependencia entre ambos. `shared/` no se expone en `ui/index.ts` — es infraestructura interna, no superficie de consumo pública.

**Colocalización por componente.** Estilos, tests, stories y subcomponentes viven junto al componente que los usa. `styles/` queda reservado exclusivamente para lo verdaderamente compartido (tokens, theme, abstracts, base).

### Convenciones de nomenclatura

- Todo el árbol de directorios usa minúsculas, salvo el nombre propio del componente (`Button/`, `Button.tsx`).
- Namespace de prefijo obligatorio en el bloque raíz BEM de cada componente para mitigar colisión de nombres entre componentes (por ejemplo, `.lds-button`, `.lds-card`). BEM no aísla clases automáticamente; el prefijo de proyecto es el mecanismo de facto de scoping.

## Justificación

- **Casing en minúsculas:** en sistemas de archivos case-sensitive (Linux, incluyendo entornos de CI) un import con casing distinto al del archivo real produce error de build. En macOS/Windows (case-insensitive por defecto) el mismo error no se manifiesta en desarrollo local, generando fallos que solo aparecen en CI. Fijar la convención desde el inicio evita esta divergencia silenciosa entre entornos.

- **Separación `tokens/` / `abstracts/`:** evita ambigüedad sobre dónde ubicar un breakpoint u otro valor de diseño cuando su definición y su forma de consumo (mixin) podrían mezclarse en un mismo archivo. Mantiene tokens consumibles de forma aislada por otras herramientas del pipeline (por ejemplo, generación de valores para JS/TS) sin arrastrar lógica SCSS.

- **`ui/shared/` con regla de promoción explícita, no anticipada:** la alternativa de crear `shared/` de forma preventiva, sin una segunda necesidad real confirmada, genera abstracciones sin uso (over-engineering). La alternativa de no tener `shared/` en absoluto lleva a duplicación de lógica entre componentes o a acoplamiento no declarado (un componente importando desde la carpeta interna de otro). La regla de "promoción al segundo uso" es el punto intermedio que evita ambos extremos.

- **BEM + prefijo de namespace en vez de CSS Modules:** dado que el stack de estilos ya está definido como SCSS/BEM (no CSS Modules), el aislamiento de clases depende enteramente de disciplina de nomenclatura. Sin un prefijo de proyecto obligatorio, la probabilidad de colisión de nombres crece linealmente con el número de componentes del sistema.

- **Colocalización sobre centralización de estilos:** al eliminar o mover un componente, no se generan archivos huérfanos en una carpeta de estilos centralizada. El costo de esta decisión es que `src/styles` no refleja el 100% de los estilos del proyecto, solo la porción verdaderamente compartida — esto es intencional y debe entenderse como tal, no como una omisión.

## Consecuencias

**Positivas:**

- Estructura predecible y escalable: incorporar un nuevo componente no requiere tocar `styles/` ni ningún directorio compartido.
- Bajo acoplamiento entre componentes: `shared/` concentra el único punto legítimo de reutilización transversal.
- Consistencia de entorno garantizada por convención de casing, reduciendo fallos de build específicos de CI.

**Negativas / costos aceptados:**

- Mayor cantidad de archivos por componente (hasta 4-5 solo en el nivel raíz del componente, más subdirectorios opcionales), lo cual incrementa el ruido visual en el explorador de archivos para componentes simples.
- La regla de promoción a `shared/` depende de disciplina del equipo — no hay enforcement automático (lint) que impida importar directamente desde la carpeta interna de otro componente. Queda como riesgo abierto (ver Condiciones de invalidación).
- BEM con prefijo manual no ofrece garantía en tiempo de compilación contra colisión de nombres, a diferencia de CSS Modules. La mitigación es puramente convencional.

## Condiciones de invalidación

Esta decisión debe revisarse si:

- Se detectan importaciones cruzadas entre carpetas internas de componentes distintos (por ejemplo, `ComponentA` importando desde `ComponentB/hooks/`) de forma recurrente, indicando que la regla de promoción a `shared/` no se está siguiendo en la práctica y requiere enforcement automatizado (regla de lint específica).
- Se detectan colisiones reales de nombres de clases BEM en producción a pesar del prefijo de namespace, lo cual motivaría evaluar una migración a CSS Modules o CSS-in-JS con scoping garantizado por herramienta.
- El design system deja de ser puro y absorbe responsabilidades de aplicación (estado global, llamadas a servicios), lo cual requeriría directorios adicionales a nivel raíz (`context/`, `services/`, `constants/`) no contemplados en esta decisión.
- Se decide publicar LDS como paquete npm con exports por subpath (`@lobo/lds/button`), lo cual podría requerir reestructurar `ui/index.ts` de barrel único a estrategia de exports múltiple — pendiente de ADR independiente si aplica.
