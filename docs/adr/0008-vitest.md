# ADR 0008 — Vitest como runner de tests unitarios y de integración

| Campo               | Valor                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Estado              | Aceptado — implementación en curso (ver §7)                                                                  |
| Fecha               | 2026-09-13                                                                                                   |
| Ámbito              | Bloque `test` de `vite.config.ts`, `vitest.setup.ts`, tests `*.test.ts(x)`, cobertura, tipos de test         |
| Supersede a         | —                                                                                                            |
| Relacionada con     | 0001 (versiones del stack), 0003 (baseline de seguridad), 0004 (estructura), 0006 (Oxlint), 0007 (Storybook) |
| Revisión programada | Migración a Vitest 5 (ADR 0001 §4), salto de major de `jsdom` o al cumplirse una _Condición de invalidación_ |

---

## 1. Contexto

ADR 0001 fijó Vitest en la línea `4.1.x` y justificó por qué no se adopta
todavía Vitest 5. ADR 0007 documentó el proyecto `storybook` (story tests en
Chromium) y, de forma tangencial, la existencia de un segundo proyecto en jsdom.
Ninguno de los dos formaliza **cómo se configura Vitest para los tests que no
son stories**: entorno, setup, tipos, cobertura, convenciones y frontera con los
story tests.

Este documento cubre ese hueco.

Requisitos que condicionan la decisión:

- **Un único runner.** El repositorio ya ejecuta story tests con Vitest (ADR
  0007). Un segundo runner (Jest) duplicaría configuración de transformación,
  alias y mocks, y rompería la cobertura consolidada.
- **Paridad de pipeline.** Los tests deben compilar el código con la misma
  transformación que el build: alias `@`, SCSS (con la inyección de tokens
  pendiente de LDS-31) y React Compiler vía `@rolldown/plugin-babel` (ADR 0001
  §5). Un test que pasa sobre código transformado de forma distinta al bundle
  publicado no prueba el artefacto real.
- **Feedback loop corto.** La lógica sin dependencia de layout (hooks, utils,
  reducers, contratos de render simples) no debe pagar el arranque de un browser
  real.
- **Coherencia con `tsconfig.base.json`.** `strict`,
  `exactOptionalPropertyTypes`, `noUnusedLocals` y `verbatimModuleSyntax`
  aplican a los tests igual que al código de producción: los tests son código
  mantenido, no scripts desechables.

---

## 2. Decisión

Se adopta **Vitest `4.1.11`** como runner único, configurado en `vite.config.ts`
con **dos proyectos**: uno unitario en `jsdom` y el proyecto `storybook` en
browser mode (ADR 0007 §2.5). Los tests unitarios usan **Testing Library**
(`@testing-library/react` + `@testing-library/jest-dom`).

### 2.1 Paquetes

Rangos declarados en `package.json` y versiones resueltas al 2026-09-13:

| Paquete                       | Declarado  | Resuelto | Rol                                                                                                  |
| ----------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `vitest`                      | `~4.1.11`  | `4.1.11` | Runner, `expect`, `vi` (mocks/spies/timers).                                                         |
| `@vitest/coverage-v8`         | `~4.1.11`  | `4.1.11` | Provider de cobertura basado en el profiler nativo de V8.                                            |
| `jsdom`                       | `^30.0.1`  | `30.0.1` | Implementación de DOM en Node para el proyecto unitario.                                             |
| `@testing-library/react`      | `^16.3.3`  | `16.3.3` | `render`, `screen`, `rerender`. Registra `cleanup` automático si `afterEach` es global (§2.4).       |
| `@testing-library/jest-dom`   | `^7.0.1`   | `7.0.1`  | Matchers de DOM (`toBeInTheDocument`, `toHaveTextContent`, …) sobre el `expect` de Vitest.           |
| `@testing-library/user-event` | `^14.6.7`  | `14.6.7` | Simulación de interacción a nivel de usuario. Instalado, **sin uso todavía**.                        |
| `@testing-library/dom`        | no directo | `10.4.1` | Peer dependency obligatoria de `@testing-library/react@16`. Hoy llega por auto-instalación de peers. |

`vitest` y todo `@vitest/*` directo comparten el rango `~4.1.11` (ADR 0003):
Vitest advierte cuando `vitest` y los paquetes `@vitest/*` difieren de versión,
y un grupo desalineado es la falla que la política de solo parches intenta
evitar. `@vitest/browser-playwright` y `playwright` pertenecen al proyecto
`storybook` y están documentados en ADR 0007 §2.1.

Los paquetes de Testing Library y `jsdom` usan `^` y **no** están en la tabla de
ADR 0003, así que Dependabot propone sus minors sin restricción. Ver riesgo en
§8.

> **Dos `expect` en el repositorio.** Los tests unitarios usan el `expect` de
> `vitest@4.1.11` con `jest-dom@7`. Las stories usan el reexportado por
> `storybook/test`, que trae `@vitest/expect@3.2.4` y `jest-dom@6.9.1` (ADR 0007
> §2.1). Un matcher disponible o con cierto comportamiento en una suite no está
> garantizado en la otra. No se resuelve alineando rangos en `package.json`.

### 2.2 Configuración en `vite.config.ts`, sin `vitest.config.ts`

La configuración de test vive en el bloque `test` de `vite.config.ts`, con
`defineConfig` importado desde `vitest/config`.

Motivos:

- **Fuente única de `plugins`, `resolve` y `css`.** Ambos proyectos declaran
  `extends: true` y heredan esa configuración de la raíz. Un `vitest.config.ts`
  separado obligaría a importar y fusionar `vite.config.ts` (`mergeConfig`) o a
  duplicar plugins, con riesgo de deriva.
- **Precedencia de Vitest.** Si existe `vitest.config.ts`, Vitest lo usa **en
  lugar de** `vite.config.ts`, no en combinación. Crear ese archivo sin fusionar
  la config de Vite desactiva en silencio el alias `@`, React Compiler y SCSS en
  los tests.

**Regla:** no crear `vitest.config.*` ni `vitest.workspace.*` en la raíz.

### 2.3 Proyectos y reparto de opciones entre raíz y proyecto

```ts
test: {
  coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  projects: [
    {
      extends: true,
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['/vitest.setup.ts'],
        css: true,
      },
    },
    { extends: true, /* storybookTest + browser mode, ADR 0007 §2.5 */ },
  ],
}
```

| Proyecto    | Nombre en reporter | Entorno                 | Archivos                                                  |
| ----------- | ------------------ | ----------------------- | --------------------------------------------------------- |
| Unitario    | `[0]` (sin nombre) | `jsdom`                 | Include por defecto: `**/*.{test,spec}.?(c\|m)[jt]s?(x)`  |
| `storybook` | `storybook`        | Chromium vía Playwright | `*.stories.*` descubiertas por `storybookTest` (ADR 0007) |

`vitest list` confirma que no hay solapamiento: el proyecto unitario no recoge
stories y el proyecto `storybook` no recoge `*.test.tsx`.

**Regla de reparto** (ya enunciada en ADR 0007 §2.5; se repite porque es la
invariante más fácil de romper al tocar este bloque):

| Ubicación                    | Qué va ahí                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `test` raíz                  | Solo opciones válidas para ambos proyectos **u opciones que Vitest solo admite en raíz** (`coverage`, `projects`, reporters). |
| `test` del proyecto unitario | Todo lo específico de jsdom: `environment`, `setupFiles`, `globals`, `css`, `include`/`exclude`.                              |

Con `extends: true`, cualquier opción de jsdom declarada en raíz se filtra al
proyecto de browser: `setupFiles` se ejecutaría en Chromium y
`environment: 'jsdom'` entraría en conflicto con browser mode.

### 2.4 Opciones del proyecto unitario

| Opción        | Valor                  | Motivo                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `environment` | `'jsdom'`              | Implementación de DOM más completa y cercana a la especificación entre las opciones en Node. Se prioriza fidelidad (roles ARIA, cálculo de nombre accesible, eventos) sobre velocidad. Ver `happy-dom` en §5.                                                                                                                              |
| `globals`     | `true`                 | **Requerido por `@testing-library/react`**, no por estilo. RTL registra `afterEach(cleanup)` solo si `afterEach` existe como global. Sin él, el DOM de cada test se acumula en el siguiente. Verificado: con `--globals=false`, 6 de los 9 tests de `TestComponent.test.tsx` fallan con `Found multiple elements with the role "heading"`. |
| `setupFiles`  | `['/vitest.setup.ts']` | Ruta relativa a la raíz del proyecto de Vite (`/` = `root`, no la raíz del filesystem). Se ejecuta antes de cada archivo de test, dentro del entorno jsdom.                                                                                                                                                                                |
| `css`         | `true`                 | Procesa CSS/SCSS importado por los componentes en lugar de sustituirlo por un módulo vacío. Necesario para que los nombres de clase de CSS Modules sean los reales y para que un error de compilación de SCSS (p. ej. un token inexistente tras LDS-31) falle en tests y no solo en build. Coste: más tiempo de transformación.            |
| `include`     | (default)              | El default de Vitest coincide con la convención de ADR 0004 (`Componente.test.tsx`). No se declara para no mantener un glob redundante.                                                                                                                                                                                                    |

Sobre `globals: true`, la decisión se limita al runtime. **A nivel de tipos no
se exponen los globals** (`vitest/globals` no está en `compilerOptions.types`):
los tests importan `describe`, `it`, `expect` y `vi` explícitamente desde
`vitest`. Ver §2.6.

`jsdom` no implementa layout ni estilos computados (`getBoundingClientRect`
devuelve ceros, `offsetWidth` es `0`, no hay media queries reales). Cualquier
test que dependa de ellos pertenece al proyecto `storybook` (§2.8).

### 2.5 `vitest.setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

El entry `/vitest` de `jest-dom` extiende el `expect` importado desde `vitest`
con `expect.extend(matchers)` y aumenta el tipo `Assertion` del módulo `vitest`.
No depende de `globals`.

Contenido que **no** debe ir en este archivo:

- `cleanup` manual de RTL: redundante con `globals: true` (§2.4).
- Polyfills o mocks globales de APIs de browser (`matchMedia`, `ResizeObserver`,
  `IntersectionObserver`) añadidos "por si acaso". Cada mock global oculta la
  ausencia de esa API en jsdom para **todos** los tests. Se añaden cuando un
  componente real los necesite, con comentario que indique cuál.

`vitest.setup.ts` está en `ignorePatterns` de `.oxlintrc.json` y fuera de todo
proyecto de `tsc -b`.

### 2.6 TypeScript

| Decisión                                                                               | Motivo                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imports explícitos desde `vitest` en cada test                                         | Sin `vitest/globals` en `types`, `describe`/`it`/`expect` no existen como globales para el compilador. Evita contaminar el scope global de todo `src/` (incluido código de producción) con identificadores de test, y hace explícito de dónde viene cada API — relevante con dos `expect` en el repositorio (§2.1).                               |
| `"@testing-library/jest-dom/vitest"` en `compilerOptions.types` de `tsconfig.app.json` | `vitest.setup.ts` está en la raíz, fuera del `include` de `tsconfig.app.json` (`src`, `.storybook`). Su import de efecto lateral nunca entra en el programa de TypeScript, así que la aumentación de `Assertion` no se aplica y `toBeInTheDocument` da `TS2339`. Declararlo en `types` lo carga explícitamente sin depender del archivo de setup. |

Alternativa descartada para el segundo punto: añadir `vitest.setup.ts` al
`include` de `tsconfig.app.json`. Funciona, pero hace que la disponibilidad de
los tipos dependa de un archivo de runtime y mezcla un archivo de raíz en el
proyecto de `src/`.

Coste aceptado: la aumentación de `Assertion` es visible desde cualquier archivo
de `src/`. Solo afecta al tipo del `expect` de `vitest`, que el código de
producción no importa; `oxlint` (plugin `import`) y la revisión de código cubren
un import accidental de `vitest` fuera de tests.

Los tests están sujetos a todas las opciones de `tsconfig.base.json`. En
particular, `noUncheckedIndexedAccess` obliga a tratar `container.querySelector`
y los índices de arrays como posiblemente `undefined` (`?.` o aserción previa).

### 2.7 Cobertura

| Opción     | Valor                | Motivo                                                                                                                                                                                   |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ubicación  | `test.coverage` raíz | `coverage` es una opción **solo de raíz** en Vitest: no se puede configurar por proyecto. El reporte consolida ambos proyectos.                                                          |
| `provider` | `'v8'`               | Instrumentación nativa de V8, sin transformación adicional del código. Es el único provider soportado por Vitest en browser mode con Chromium, lo que permite consolidar unit + stories. |
| `reporter` | `['text', 'lcov']`   | `text` para consola local y CI; `lcov` (`coverage/lcov.info`) como formato de intercambio para servicios o para la extensión del editor.                                                 |

**No se declaran `include` ni `thresholds`.** En Vitest 4 se eliminó
`coverage.all`: sin `coverage.include`, el reporte **solo contiene archivos
cargados por algún test**. Un componente sin tests no aparece como 0 %, no
aparece en absoluto. La cifra global resultante es optimista por construcción y
no debe usarse como métrica ni como gate hasta resolver §8.

`coverage/` está ignorado por Git, Prettier y Oxlint.

### 2.8 Convenciones de tests unitarios

| Convención                                                                                                            | Motivo                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colocalización: `src/ui/<categoría>/<Componente>/<Componente>.test.tsx`                                               | ADR 0004. `.test.ts` si el archivo no contiene JSX (`react/jsx-filename-extension: as-needed`, ADR 0006).                                                                                                                                          |
| Frontera con stories: `*.test.tsx` para lógica sin dependencia de layout; interacción visual en `play`                | ADR 0007 §2.6. Hooks, utils, reducers, contratos de props y casos límite de datos van aquí. Foco, CSS computado, a11y dependiente de estilos e interacciones que se quieran ver en el sidebar van en la story. No duplicar el mismo caso en ambas. |
| Queries por rol y nombre accesible (`getByRole('heading', { level: 1, name })`) antes que `getByText`/`querySelector` | Prioridad de queries de Testing Library. En un design system, una query por rol que falla es un defecto de accesibilidad, no un detalle de test. `container.querySelector` solo cuando no hay rol (p. ej. un elemento vacío sin nombre accesible). |
| `userEvent` en lugar de `fireEvent` para interacción                                                                  | `userEvent` reproduce la secuencia completa de eventos de un usuario (pointer, focus, keydown, input). `fireEvent` dispara un único evento sintético y oculta bugs de manejo de foco.                                                              |
| `describe` por escenario (`happy path`, `edge cases`) con nombres de test en inglés que describan comportamiento      | Legibilidad del reporter y consistencia con identificadores de código.                                                                                                                                                                             |
| Nunca commitear un test en rojo intencional; para documentar un fallo esperado, `it.fails`                            | `vitest run` es binario: un rojo permanente normaliza la suite en rojo y enmascara regresiones reales. `it.fails` invierte la semántica y pasa a verde si el comportamiento se corrige, forzando a actualizar el test.                             |

---

## 3. Comandos

```jsonc
// package.json
"test": "vitest run"
```

| Comando                                         | Comportamiento                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm test`                                     | Ejecución única de **ambos** proyectos. Requiere binarios de Playwright por el proyecto `storybook` (ADR 0007 §3). |
| `pnpm exec vitest`                              | Watch mode de ambos proyectos.                                                                                     |
| `pnpm exec vitest run src/ui/base/<Componente>` | Filtro por ruta. Solo coinciden `*.test.*` del proyecto unitario y stories bajo esa ruta.                          |
| `pnpm exec vitest run --project=storybook`      | Solo story tests.                                                                                                  |
| `pnpm exec vitest run --coverage`               | Ejecución con cobertura consolidada; salida en consola y `coverage/lcov.info`. Ver limitación de §2.7.             |
| `pnpm exec vitest list`                         | Lista los tests descubiertos con el proyecto al que pertenecen. Primer diagnóstico ante un test que "no corre".    |

No existe hoy una forma ergonómica de ejecutar **solo** el proyecto unitario: al
no tener `name`, no se puede seleccionar con `--project`. Ver §8.

---

## 4. Integración con el resto del tooling

### 4.1 Oxlint (ADR 0006)

El override de `**/*.{test,spec}.{ts,tsx}` y `**/__tests__/**` habilita el
plugin `vitest` y relaja `typescript/no-non-null-assertion` y
`eslint/max-params` (ADR 0006 §2.6). `oxlint` pasa sin diagnósticos sobre
`TestComponent.test.tsx`.

### 4.2 Prettier (ADR 0005)

Los tests se formatean como el resto del código. `coverage` está en
`.prettierignore`.

### 4.3 Storybook (ADR 0007)

El proyecto unitario y el proyecto `storybook` comparten raíz, `plugins`,
`resolve` y `css`, y nada más. El estado del panel de tests de Storybook solo
refleja el proyecto `storybook`: un `*.test.tsx` en rojo no se ve en el sidebar,
pero sí hace fallar `pnpm test`.

### 4.4 Vitest 5 (ADR 0001 §4)

Breaking changes de Vitest 5 con impacto directo en esta configuración, a
revisar en la migración:

- `clearMocks: true` por defecto: `vi.clearAllMocks()` antes de cada test. Rompe
  tests que acumulen llamadas entre `it`.
- Aserciones asíncronas sin `await` fallan el test en lugar de emitir warning.
- Se eliminan `describe.sequential` / `test.sequential`.
- Proyectos inline heredan la raíz por defecto; sin impacto aquí porque
  `extends: true` ya es explícito.

---

## 5. Alternativas consideradas

| Alternativa                                              | Por qué se descartó                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jest + `babel-jest` / `@swc/jest`                        | Segunda pipeline de transformación sin Rolldown ni el plugin de React Compiler de Vite: se pierde la paridad de §1. Alias y SCSS habría que reconfigurarlos con `moduleNameMapper` y transformers. Dos runners, dos APIs de mock, dos reportes de cobertura.                                                                                                          |
| `happy-dom` como entorno                                 | Generalmente más rápido que jsdom, pero con menor cobertura de la especificación DOM y de las APIs que usa Testing Library para roles y nombres accesibles. En un design system una discrepancia de a11y en el entorno produce falsos verdes. Revaluable si el tiempo del proyecto unitario se vuelve el cuello de botella (§9). No se ha medido en este repositorio. |
| Todos los tests en browser mode (sin jsdom)              | Máxima fidelidad, pero cada ejecución paga el arranque de Chromium incluso para una función pura, y obliga a tener Playwright instalado para cualquier test. Se reserva el browser para lo que lo necesita (ADR 0007).                                                                                                                                                |
| `vitest.config.ts` separado con `mergeConfig`            | Un archivo más con la misma información y una fusión que puede divergir de `vite.config.ts`. Sin beneficio mientras la config de test quepa en un bloque (§2.2).                                                                                                                                                                                                      |
| `globals: false` + `cleanup` manual en `vitest.setup.ts` | Funcionalmente equivalente, pero depende de un `afterEach(cleanup)` que cualquiera puede borrar sin que un test concreto lo detecte de inmediato. Con `globals: true` el cleanup es el comportamiento documentado de RTL.                                                                                                                                             |
| `vitest/globals` en `compilerOptions.types`              | Menos imports por archivo a cambio de exponer `describe`/`expect`/`vi` como globales de tipo en todo `src/`, código de producción incluido.                                                                                                                                                                                                                           |
| `@vitest/coverage-istanbul`                              | Instrumenta el código con una transformación extra y no es la opción preferente para consolidar cobertura de browser mode en Chromium. V8 no altera el código transformado que se ejecuta.                                                                                                                                                                            |

---

## 6. Consecuencias

**Positivas**

- Un único runner para unit y story tests, con la misma transformación que el
  bundle publicado (alias, SCSS, React Compiler).
- Feedback loop rápido para lógica sin layout: el proyecto unitario no depende
  de Playwright.
- Matchers de DOM tipados y verificados por `tsc -b`.
- Convenciones de queries que convierten los tests unitarios en una verificación
  adicional de semántica accesible.

**Negativas / costos aceptados**

- **`jsdom` no es un browser.** Sin layout, sin estilos computados, sin media
  queries. Un test verde en jsdom no garantiza comportamiento visual; la
  frontera de §2.8 debe respetarse para que la suite no dé falsa confianza.
- **`css: true` encarece la transformación** de cada archivo que importe
  estilos. Se acepta a cambio de detectar errores de SCSS en tests.
- **`globals: true` a nivel runtime pero no de tipos** es una asimetría
  deliberada que hay que conocer: los globales existen, pero TypeScript no los
  reconoce.
- **Cobertura optimista** mientras no exista `coverage.include` (§2.7).
- **Dos `expect`** (unit vs. stories) con versiones de matchers distintas
  (§2.1).
- **Dependencias de test sin pin de minor** (`jsdom`, Testing Library) fuera de
  la política de ADR 0003.

---

## 7. Estado de la implementación (2026-09-13)

Verificación ejecutada en esa fecha (Node 22.12.0, Vitest 4.1.11) sobre el
working tree:

| Verificación                     | Resultado                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest list`                    | ✅ Proyecto unitario: 9 tests de `TestComponent.test.tsx`. Proyecto `storybook`: 2 stories de `TestComponent.stories.ts`. Sin solapamiento.                                                          |
| `vitest run` (ambos proyectos)   | ❌ 2 archivos / 11 tests: 10 en verde, 1 en rojo. El rojo es `intentional failure > fails intentionally: expects an h2 instead of an h1`, escrito a propósito. Duración ≈2,2 s, ≈3,7 s de wall time. |
| `vitest run … --globals=false`   | ❌ 6 de 9 fallan por acumulación de DOM entre tests. Valida la decisión de §2.4; no se repite.                                                                                                       |
| `tsc -b`                         | ✅ Sin errores tras añadir `@testing-library/jest-dom/vitest` a `types` (§2.6). Antes: `TS2339` en `toBeInTheDocument`.                                                                              |
| `prettier --check` sobre el test | ✅                                                                                                                                                                                                   |
| Warning de `vite.config.ts`      | ⚠️ `__dirname` no soportado por `configLoader: 'native'`, emitido una vez por proyecto. Pendiente en ADR 0007 §8.                                                                                    |

Desviaciones abiertas respecto a ADRs aceptados:

| Desviación                                                                                                                                | ADR afectado |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `TestComponent.test.tsx` contiene un test en rojo intencional (§2.8).                                                                     | 0008         |
| ADR 0007 §7 afirma que "no existe ningún `*.test.tsx`" y que el proyecto jsdom no se ejercita. Ya no es cierto.                           | 0007         |
| `src/ui/base/test-component/` sigue en kebab-case y es un componente de prueba (ADR 0007 §8, bloqueante 2). El test hereda esa ubicación. | 0004, 0007   |

---

## 8. Pendientes y riesgos abiertos

Bloqueantes para integrar CI:

1. **Test en rojo intencional.** Eliminarlo o convertirlo a `it.fails` antes de
   que exista un workflow; de lo contrario CI nace en rojo.
2. **`@testing-library/dom` como dependencia directa.** Es peer dependency
   obligatoria de `@testing-library/react@16` y hoy se resuelve solo por
   auto-instalación de peers de pnpm. Declararlo en `devDependencies` hace la
   resolución explícita y sujeta a Dependabot.

No bloqueantes:

- **Nombrar el proyecto unitario** (`name: 'unit'`) para poder ejecutar
  `vitest run --project=unit` y leer el reporter sin el prefijo `[0]`.
- **Scripts separados** `test:unit` y `test:storybook` sobre esos nombres (ya
  propuesto en ADR 0007 §8).
- **`coverage.include`** (p. ej. `['src/**/*.{ts,tsx}']`) y `coverage.exclude`
  para stories, `*.test.*`, `*.d.ts`, `index.ts` de barrels y
  `src/main.tsx`/`src/App.tsx`. Solo después, `thresholds` como gate de CI.
- **Política de versiones para dependencias de test.** Decidir si `jsdom` y
  `@testing-library/*` pasan a `~` y a la tabla de ADR 0003. Argumento a favor:
  un minor de `jsdom` puede cambiar el cálculo de roles o nombres accesibles y
  alterar el resultado de tests sin cambios de código.
- **`setupFiles` con ruta `'/vitest.setup.ts'`.** Correcta (relativa a `root`),
  pero se lee como ruta absoluta del filesystem. Valorar `'./vitest.setup.ts'`
  por legibilidad.
- **`vitest.setup.ts` fuera de `tsc -b`.** Hoy es una línea; si crece (mocks de
  APIs de browser), incluirlo en un proyecto de TypeScript con `lib: DOM`.
- **`@testing-library/user-event` sin uso.** Validar la convención de §2.8 con
  el primer componente interactivo o retirar la dependencia.
- **Actualizar ADR 0007 §7** con el estado del proyecto unitario.

---

## 9. Condiciones de invalidación

Esta decisión debe revisarse si:

- La migración a Vitest 5 (ADR 0001 §4) cambia la semántica de `globals`,
  `setupFiles`, `coverage` o `projects` de forma que las reglas de §2.3–§2.7
  dejen de ser válidas.
- El proyecto unitario supera de forma sostenida el tiempo que justifica un
  feedback loop sin browser → medir `happy-dom` contra `jsdom` en este
  repositorio antes de cambiar.
- `@testing-library/react` deja de depender de `afterEach` global para el
  cleanup automático, lo que eliminaría el motivo de `globals: true`.
- La mayoría de los tests unitarios de componentes empieza a requerir mocks de
  layout (`getBoundingClientRect`, `ResizeObserver`) → señal de que esos casos
  pertenecen al proyecto `storybook` y de que la frontera de §2.8 no se está
  respetando.
- Storybook deja de reexportar un `expect` propio y alinea su versión con
  `vitest`, lo que permitiría unificar la guía de matchers de ambas suites.

---

## 10. Referencias

- Vitest — configuración: <https://vitest.dev/config/>
- Vitest — projects y `extends`: <https://vitest.dev/guide/projects>
- Vitest — entornos de test: <https://vitest.dev/guide/environment>
- Vitest — cobertura: <https://vitest.dev/guide/coverage>
- Vitest — guía de migración (v4 y v5): <https://vitest.dev/guide/migration/>
- Vitest — CLI (`--project`, `list`): <https://vitest.dev/guide/cli>
- Testing Library — prioridad de queries:
  <https://testing-library.com/docs/queries/about#priority>
- Testing Library — `cleanup` automático en React Testing Library:
  <https://testing-library.com/docs/react-testing-library/api#cleanup>
- Testing Library — `user-event`:
  <https://testing-library.com/docs/user-event/intro>
- `jest-dom` — uso con Vitest:
  <https://github.com/testing-library/jest-dom#with-vitest>
- jsdom: <https://github.com/jsdom/jsdom>
