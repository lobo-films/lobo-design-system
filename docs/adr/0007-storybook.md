# ADR 0007 — Storybook como entorno de desarrollo, documentación y testing de componentes

| Campo               | Valor                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Estado              | Aceptado — implementación en curso (ver §7)                                                                    |
| Fecha               | 2026-09-13 (estado de implementación revisado el mismo día, §7)                                                |
| Ámbito              | `.storybook/`, stories (`*.stories.ts(x)`, `*.mdx`), proyecto `storybook` de Vitest, scripts asociados         |
| Supersede a         | —                                                                                                              |
| Relacionada con     | 0001 (versiones del stack), 0003 (baseline de seguridad), 0004 (estructura), 0005 (Prettier), 0006 (Oxlint)    |
| Revisión programada | Migración a Vitest 5 (ADR 0001 §4), salto de minor de Storybook o al cumplirse una _Condición de invalidación_ |

---

## 1. Contexto

ADR 0001 eligió Storybook como entorno de desarrollo y testing de componentes y
fijó su línea de versión (`10.6.x`), pero no su configuración. ADR 0004
prescribe stories colocalizadas junto a cada componente
(`Button/Button.stories.tsx`) y ADR 0006 declaró por adelantado un override de
Oxlint para ellas. Este documento formaliza la instalación: qué paquetes se
usan, cómo se configuran, cómo se integran con Vite y Vitest, y qué convenciones
deben seguir las stories.

Requisitos que condicionan la decisión:

- **LDS es una librería sin aplicación consumidora dentro del repositorio.**
  `src/App.tsx` es un playground local, no un entorno de validación. Hace falta
  un host que renderice cada componente de forma aislada, en todos sus estados,
  sin montar una app.
- **Documentación derivada del código.** La API pública (props, variantes,
  defaults) debe documentarse a partir de los tipos y las stories, no mantenerse
  en paralelo.
- **Testing en browser real.** Los componentes de un design system dependen de
  layout, foco, eventos de puntero y CSS computado. `jsdom` no implementa layout
  ni estilos computados de forma fiable; las interacciones y las verificaciones
  de accesibilidad deben ejecutarse en un motor real.
- **Paridad de pipeline.** Las stories deben compilarse con la misma
  configuración que el build de la librería: alias `@`, preprocesado SCSS (con
  la inyección de tokens pendiente de LDS-31) y React Compiler.
- **Accesibilidad como requisito de primer nivel.** Un defecto a11y en una
  primitiva de `ui/base/` se propaga a todos los consumidores (mismo argumento
  que ADR 0006 §2.1 para `jsx-a11y`, pero a nivel de DOM renderizado).

---

## 2. Decisión

Se adopta **Storybook 10.6 con el framework `@storybook/react-vite`**, usando
las stories como fuente única para tres propósitos: entorno de desarrollo
aislado, documentación de la API pública y suite de tests de componentes
ejecutada por Vitest en browser mode.

### 2.1 Paquetes

Rangos declarados en `package.json` y versiones resueltas en `pnpm-lock.yaml` al
2026-09-13:

| Paquete                      | Declarado | Resuelto | Rol                                                                                                                              |
| ---------------------------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `storybook`                  | `~10.6.0` | `10.6.0` | Core, CLI (`storybook dev`/`build`) y módulos runtime (`storybook/test`, `storybook/actions`, …).                                |
| `@storybook/react-vite`      | `~10.6.0` | `10.6.0` | Framework: renderer de React + `@storybook/builder-vite`. Resuelve contra `vite@8.3.0` del proyecto.                             |
| `@storybook/addon-docs`      | `~10.6.0` | `10.6.0` | Autodocs y MDX. Extrae la tabla de props de los componentes vía docgen (ver §6).                                                 |
| `@storybook/addon-a11y`      | `~10.6.0` | `10.6.0` | Auditoría con axe-core, en el panel de UI y como aserción en los story tests (§2.5).                                             |
| `@storybook/addon-vitest`    | `~10.6.0` | `10.6.0` | Convierte cada story en un test de Vitest (`storybookTest`) y expone ejecución/estado por story desde el sidebar.                |
| `@storybook/addon-mcp`       | `~10.6.0` | `10.6.0` | Servidor MCP sobre el dev server: expone metadatos de componentes y stories a agentes de código. Solo activo en `storybook dev`. |
| `@chromatic-com/storybook`   | `~5.3.1`  | `5.3.1`  | Integración con Chromatic (visual regression SaaS). Instalado, **no operativo** (§7, §8).                                        |
| `@vitest/browser-playwright` | `~4.1.11` | `4.1.11` | Provider de browser mode para Vitest 4.1.                                                                                        |
| `playwright`                 | `~1.63.0` | `1.63.0` | Runtime de Chromium headless para el proyecto `storybook` de Vitest.                                                             |

Política de rangos: `~` (solo parches) en todo el tooling de Storybook y de
testing en browser. `vitest` y `@vitest/coverage-v8` se declaran también en
`~4.1.11`, de modo que todo el grupo `@vitest/*` directo comparte rango y un
`pnpm update` no puede desalinearlo (Vitest advierte cuando `vitest` y los
paquetes `@vitest/*` difieren de versión). `playwright` en `~1.63.0` fija además
la revisión de Chromium descargada: un salto de minor de Playwright cambia el
browser y puede cambiar el render.

`storybook@10.6.0` trae como dependencias propias `@vitest/expect@3.2.4`,
`@vitest/spy@3.2.4`, `@testing-library/jest-dom@6.9.1` y `esbuild@0.28.2`. Es
decir, el `expect`/`fn` que las stories importan desde `storybook/test` **no es
el de `vitest@4.1.11`** ni el `jest-dom@7` que usan los tests unitarios. Las
diferencias de matchers entre ambas suites son esperables y no se resuelven
alineando versiones en `package.json`.

Se usa `@storybook/react-vite` y no `@storybook/react-webpack5` porque el
proyecto no tiene toolchain de webpack: builder-vite reutiliza la configuración
y los plugins de `vite.config.ts` (Rolldown, Oxc, plugin de React), evitando una
segunda pipeline de transformación que habría que mantener en paridad.

### 2.2 `.storybook/main.ts`

```ts
const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
};
```

| Clave       | Decisión                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framework` | Sin opciones. `builder.viteConfigPath` no se declara: builder-vite descubre `vite.config.ts` en la raíz. Si se añade `viteFinal`, debe limitarse a ajustes específicos de Storybook y no duplicar plugins de la raíz.  |
| `stories`   | Glob sobre todo `src/`. Compatible con la colocalización de ADR 0004 sin mantener una lista por categoría (`base/`, `composed/`, `layouts/`). El coste es que cualquier `*.mdx` o `*.stories.*` bajo `src/` se indexa. |
| `addons`    | Se omite `@storybook/addon-essentials`: en Storybook 10 controls, actions, backgrounds, viewport y toolbars forman parte del core. Solo se declaran addons con funcionalidad fuera del core.                           |

No se declara `docs.defaultName` ni `typescript.reactDocgen`: se aceptan los
defaults (`Docs`, `react-docgen`). Ver implicaciones en §6.

### 2.3 `.storybook/preview.ts`

| Parámetro                        | Valor                                    | Motivo                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parameters.backgrounds.options` | `light: #ffffff`, `dark: #1a1a1a`        | API de backgrounds basada en `globals` (Storybook ≥ 9). Valores provisionales hasta que existan tokens de color (LDS-31); deben reemplazarse por los tokens de superficie del tema. |
| `initialGlobals.backgrounds`     | `{ value: 'dark' }`                      | Fondo inicial del canvas. Se fija vía `initialGlobals` (no `parameters.backgrounds.default`, deprecado) para que sea seleccionable desde la toolbar y serializable en la URL.       |
| `parameters.controls.matchers`   | `color: /(background\|color)$/i`, `date` | Infiere control de color/fecha por nombre de prop. Evita declarar `argTypes` repetitivos.                                                                                           |
| `parameters.a11y.test`           | `'todo'`                                 | Las violaciones de axe se reportan en la UI de tests pero **no fallan** la ejecución. Estado transitorio de bootstrap; ver criterio de promoción a `'error'` en §8.                 |

La clave del global es `value` (tipo `GlobalState = { value; grid? }` de
`storybook/backgrounds`). El archivo actual declara `{ name: 'dark' }`, que no
aplica ningún fondo; `tsc -b` no lo detecta porque `.storybook/` no forma parte
de ningún proyecto de TypeScript (§4.2, §7).

Decorators globales (provider de tema, import de `styles/main.scss`) se añadirán
en este archivo cuando exista la capa de `styles/` de ADR 0004. Hasta entonces
el archivo no contiene JSX y se mantiene como `.ts` (ver §4.1); al introducir el
primer decorator con JSX se renombra a `preview.tsx`.

### 2.4 Integración con Vite

`@storybook/builder-vite` carga `vite.config.ts` y lo fusiona con su propia
configuración. Consecuencias directas:

- **Alias y SCSS.** `resolve.alias['@']` y `css.preprocessorOptions.scss`
  aplican dentro de Storybook sin configuración adicional. Cuando LDS-31 active
  `additionalData: '@use "@/styles/tokens" as *;'`, las stories lo heredan.
- **React Compiler.** El proyecto usa hoy la ruta Babel
  (`@rolldown/plugin-babel`
  - `reactCompilerPreset()`), que por tanto también corre en el dev server de
    Storybook y en los story tests. ADR 0001 §5 anticipa la degradación de HMR y
    cold start que esto implica a medida que crece el número de componentes; la
    decisión Babel vs. Oxc sigue pendiente de ADR propio y afecta a Storybook
    tanto como al build.
- **Paridad de output.** Un componente se renderiza en Storybook con la misma
  transformación que en el bundle publicado, lo que permite que un story test
  detecte regresiones introducidas por el compilador (memoización incorrecta,
  hooks reordenados), no solo por el código fuente.

### 2.5 Story tests: proyecto `storybook` de Vitest

`vite.config.ts` define dos proyectos en `test.projects`:

| Proyecto     | Entorno                                     | Alcance                                                                                      |
| ------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| (sin nombre) | `jsdom`, `globals`, `vitest.setup.ts`       | Tests unitarios/integración (`*.test.tsx`, ADR 0004).                                        |
| `storybook`  | Browser mode, Playwright, Chromium headless | Una story = un test. Render + `play` function + auditoría a11y según `parameters.a11y.test`. |

```ts
{
  extends: true,
  plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: 'chromium' }],
    },
  },
}
```

Semántica de ejecución de cada story:

1. Se renderiza con los `args`, `decorators` y `parameters` resueltos (globales
   de `preview.tsx` → meta → story).
2. Si define `play`, se ejecuta. Las aserciones usan `expect`, `fn` y
   `userEvent` reexportados desde `storybook/test` (Vitest + Testing Library
   bajo el capó); no se importan `vitest` ni `@testing-library/*` directamente
   en stories.
3. Con `a11y.test: 'error'` se ejecuta axe-core sobre el DOM renderizado y una
   violación falla el test. Con `'todo'` solo se reporta.
4. Una story sin `play` sigue siendo un smoke test: falla si el render lanza.

**`extends: true` es obligatorio.** Es lo que generan todas las plantillas de
`@storybook/addon-vitest@10.6.0` y lo que requiere este repositorio (ADR 0001
§3.1, corregido). En Vitest 4 el default es `extends: false`: sin la
declaración, el proyecto `storybook` no hereda `plugins` (plugin de React +
React Compiler), `resolve.alias` ni `css` de la raíz, y se pierde la paridad
requerida en §1. No hereda `jsdom` ni `setupFiles`, porque en esta configuración
están declarados dentro del proyecto unitario y no en `test` raíz.
Implicaciones:

- **#36082 no afecta a este proyecto:** Vitest 5 cambia el default de `extends`
  a heredar, y aquí la herencia ya es explícita. No hay cambio de
  comportamiento.
- **No usar `extends: false`** en el proyecto `storybook`, ni ahora ni en la
  migración a Vitest 5 (ADR 0001 §4, paso 4).
- **`@storybook/react-vite@10.6.0` no depende de `@vitejs/plugin-react`:** el
  plugin de React del proyecto `storybook` es el heredado de la raíz, sin riesgo
  de doble instancia.
- **Regla de mantenimiento:** cualquier opción de `test` que sea específica de
  jsdom (`environment`, `setupFiles`, `css`, `globals`, `include`) va dentro del
  proyecto unitario, nunca en `test` raíz, o se filtrará al proyecto de browser.

Verificación ejecutada el 2026-09-13 (Node 22.12.0, Vitest 4.1.11):

| Escenario                                                | Resultado                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vitest run` (ambos proyectos), `extends: true`          | ✅ 3 archivos / 8 tests en verde. Sin `Invalid hook call` ni `Duplicate __self prop`. |
| Story temporal que importa `@/…`, `extends: true`        | ✅ Resuelve y pasa.                                                                   |
| Misma story, proyecto `storybook` con `extends: false`   | ❌ `Failed to resolve import "@/…"`.                                                  |
| Stories de ejemplo (sin alias ni SCSS), `extends: false` | ✅ Pasan: el fallo solo aparece al usar configuración heredada de la raíz.            |

Estas pruebas validan la decisión sobre `extends` y no se repiten. El resultado
de la suite con el working tree actual está en §7.

### 2.6 Convenciones de stories

| Convención                                                                                                                      | Motivo                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colocalización: `src/ui/<categoría>/<Componente>/<Componente>.stories.ts(x)`, carpeta en PascalCase                             | ADR 0004 (`Button/`, `Button.tsx`). Al borrar o mover un componente no quedan stories huérfanas.                                                                                                                                   |
| Extensión `.stories.ts` por defecto; `.stories.tsx` solo si la story contiene JSX (`render`, decorators locales)                | `react/jsx-filename-extension` (`as-needed`, ADR 0006) rechaza `.tsx` sin JSX. Una story solo con `args` no tiene JSX. Precisa el árbol de ADR 0004, que muestra `Button.stories.tsx` como ejemplo.                                |
| CSF 3: `const meta = { … } satisfies Meta<typeof X>; export default meta;` + stories como named exports `StoryObj<typeof meta>` | `satisfies` preserva el tipo literal de `meta`, de modo que `StoryObj<typeof meta>` hace obligatorios en cada story los `args` requeridos que `meta` no provee. El default export es requisito de CSF (override de ADR 0006 §2.6). |
| `title` alineado con ADR 0004: `Base/Button`, `Composed/Card`, `Layouts/Stack`                                                  | El árbol del sidebar refleja la taxonomía de la librería. Omitir `title` genera la jerarquía desde la ruta de archivo (`Ui/Base/Button/Button`), con un nivel redundante.                                                          |
| `tags: ['autodocs']` en el `meta` de todo componente exportado por `ui/index.ts`                                                | La página Docs es la referencia de API pública. Componentes internos (`components/` de ADR 0004) no llevan story propia.                                                                                                           |
| Callbacks como `args: { onClick: fn() }`                                                                                        | Spies registrados en el panel de actions y asertables en `play` (`expect(args.onClick).toHaveBeenCalled()`).                                                                                                                       |
| Interacciones y aserciones en `play`, no en `*.test.tsx` duplicados                                                             | Un único artefacto sirve de ejemplo visual y de test. `*.test.tsx` en jsdom queda para lógica sin dependencia de layout (hooks, utils, reducers).                                                                                  |
| MDX solo para documentación conceptual (guías, tokens, principios)                                                              | La documentación de API se genera con autodocs; un MDX por componente duplicaría la tabla de props y se desincronizaría.                                                                                                           |

---

## 3. Comandos

```jsonc
// package.json
"storybook":       "storybook dev -p 6006",
"build-storybook": "storybook build",
"test":            "vitest run"
```

| Comando                                    | Comportamiento                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm storybook`                           | Dev server en `:6006` con HMR. Habilita el panel de tests por story (addon-vitest) y el endpoint MCP (addon-mcp).      |
| `pnpm build-storybook`                     | Build estático en `storybook-static/` (ignorado por git, Prettier y Oxlint).                                           |
| `pnpm test`                                | Ejecuta **ambos** proyectos: unitarios en jsdom y story tests en Chromium. Requiere binarios de Playwright instalados. |
| `pnpm exec vitest run --project=storybook` | Solo story tests.                                                                                                      |
| `pnpm exec vitest --project=storybook`     | Watch mode de story tests (equivalente CLI al panel de Storybook).                                                     |
| `pnpm exec playwright install chromium`    | Descarga el binario de Chromium correspondiente a la versión de `playwright` resuelta. En CI Linux: `--with-deps`.     |

---

## 4. Integración con el resto del tooling

### 4.1 Oxlint (ADR 0006)

Resuelto en `.oxlintrc.json`. `oxlint` pasa sin diagnósticos sobre todo el
repositorio.

| Override                                                   | Archivos                | Motivo                                                         |
| ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `import/no-default-export: off`                            | `.storybook/*.{ts,tsx}` | Storybook exige default export en `main` y `preview`.          |
| `env: { browser: false, node: true }`                      | `.storybook/main.ts`    | Lo carga la CLI de Storybook en Node, igual que `*.config.*`.  |
| — (entorno por defecto)                                    | `.storybook/preview.ts` | Se ejecuta en el iframe del browser.                           |
| `react/jsx-filename-extension` (`as-needed`), sin override | `preview`, stories      | Resuelto con extensión `.ts` en archivos sin JSX (§2.3, §2.6). |

### 4.2 TypeScript

`tsconfig.app.json` incluye `src/` (stories incluidas); `tsconfig.node.json`
solo incluye `vite.config.ts`. `tsc -b` pasa, pero **`.storybook/` sigue fuera
de todo proyecto y no se verifica**. El defecto de `initialGlobals` de §2.3 es
un ejemplo de lo que pasa inadvertido. Se debe incluir `.storybook/main.ts` en
`tsconfig.node.json` y `.storybook/preview.ts` en un proyecto con `lib: DOM` (p.
ej. `tsconfig.app.json`). Las stories quedan sujetas a
`exactOptionalPropertyTypes` y `noUnusedLocals`, igual que los componentes.

`vitest.shims.d.ts` (generado por `storybook add @storybook/addon-vitest`, con
`/// <reference types="@vitest/browser-playwright" />`) se eliminó. Ese archivo
solo aporta tipos para la API de `vitest/browser` (`page`, `userEvent` de
Vitest, locators), que ningún archivo importa hoy; `vite.config.ts` compila sin
él. Si un test futuro importa `vitest/browser`, la referencia debe añadirse en
`compilerOptions.types` del proyecto correspondiente en lugar de restaurar el
archivo suelto.

### 4.3 Prettier (ADR 0005)

`storybook-static` ya está en `.prettierignore`. Los archivos generados por
`storybook init` ya se formatearon: `prettier . --check` pasa sobre todo el
repositorio. Cualquier regeneración con la CLI de Storybook (`storybook add`,
`storybook automigrate`) debe ir seguida de `pnpm prettier:fix`.

### 4.4 Git

`.gitignore` ignora `storybook-static/*` y `*storybook.log`. Esta última entrada
es redundante con `*.log`, ya presente; se mantiene como documentación explícita
del artefacto (`debug-storybook.log`).

---

## 5. Alternativas consideradas

| Alternativa                                                   | Por qué se descartó                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ladle                                                         | Basado en Vite y compatible con CSF, arranque más rápido y menor árbol de dependencias. Sin equivalente a addon-vitest (story tests en browser mode con estado en la UI) ni a addon-a11y integrado en test; habría que reconstruir ambos con tooling propio. |
| React Cosmos                                                  | Modelo de fixtures propio, no CSF. Sin generación de docs a partir de tipos; las fixtures no son reutilizables como tests sin adaptación.                                                                                                                    |
| Sitio de documentación propio (Docusaurus / Astro) + Vitest   | Control total del diseño de la documentación, pero obliga a construir playground, controles de props, aislamiento de componentes y la relación ejemplo ↔ test manualmente. Coste de mantenimiento desproporcionado para el tamaño del equipo.                |
| Storybook + tests de interacción con `@storybook/test-runner` | Runner basado en Jest + Playwright contra un Storybook levantado. Requiere servidor en ejecución, segunda configuración de test y no comparte pipeline con Vitest. addon-vitest es la ruta recomendada upstream desde Storybook 8.5.                         |
| Solo tests en jsdom (`*.test.tsx`) sin story tests            | Sin layout, foco real ni CSS computado. No detecta regresiones visuales ni de accesibilidad dependientes de estilos (contraste, elementos ocultos, orden de foco).                                                                                           |
| `@storybook/react-webpack5`                                   | Introduce webpack y Babel/SWC como segunda pipeline, rompiendo la paridad con el build de Vite 8 / Rolldown.                                                                                                                                                 |

---

## 6. Consecuencias

**Positivas**

- Una story es a la vez ejemplo, documentación y test: se elimina la deriva
  entre los tres artefactos.
- Story tests en Chromium real con la misma transformación que el bundle
  publicado (alias, SCSS, React Compiler).
- Auditoría a11y automatizable por story, sin configuración adicional por
  componente.
- Documentación de API generada desde los tipos de TypeScript.
- Un único runner (Vitest) para tests unitarios y de componentes; cobertura v8
  consolidada.

**Negativas / costos aceptados**

- **Árbol de dependencias de desarrollo significativamente mayor** (Storybook,
  Playwright, axe-core, MCP SDK). Aumenta la superficie de supply chain (ADR
  0003); todos son devDependencies y no llegan al bundle.
- **Binarios de browser como dependencia de CI.** `pnpm test` falla sin
  `playwright install`. La revisión de Chromium está acoplada a la versión de
  `playwright`: cada bump implica una nueva descarga (~150 MB) y potencialmente
  cambios de render. En la máquina de desarrollo ya coexisten dos revisiones
  (`chromium-1234` y `chromium-1243`).
- **`pnpm test` es más lento** al incluir browser mode: ≈3,5 s de wall time con
  una sola story file (2 stories sin `play`) y ≈4–4,5 s con 9 stories. El coste
  fijo es el arranque de Chromium; el variable crece con el número de stories y
  con las `play` functions.
- **Dos versiones de `expect` en el repositorio.** Las stories usan
  `@vitest/expect@3.2.4` y `jest-dom@6.9.1` (vía `storybook/test`); los tests
  unitarios, `vitest@4.1.11` y `jest-dom@7`. Un matcher disponible en una suite
  puede no estarlo, o comportarse distinto, en la otra.
- **Limitaciones de `react-docgen`** (default): analiza el AST del archivo sin
  resolver tipos importados. Props heredadas vía
  `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>`
  (patrón prescrito por ADR 0006 §2.4) no aparecen en la tabla de props, y tipos
  definidos en otro módulo se muestran como referencia sin expandir.
  `react-docgen-typescript` los resuelve a costa de un dev server notablemente
  más lento. Se acepta el default hasta que la documentación resultante resulte
  insuficiente.
- **React Compiler vía Babel en el dev server de Storybook** (ADR 0001 §5):
  coste de HMR proporcional al número de componentes mientras no se migre a Oxc.
- **Acoplamiento de versiones Storybook ↔ Vitest ↔ Vite.** Cualquier salto de
  minor en uno de los tres requiere validar los otros dos (motivo de la política
  de ADR 0003).

---

## 7. Estado de la implementación (2026-09-13)

La instalación está en el working tree sin commit. Verificación ejecutada en esa
fecha (Node 22.12.0) sobre el working tree completo, cuarta revisión del día:

| Verificación                   | Resultado                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest run` (ambos proyectos) | ✅ 1 archivo / 2 tests (`TestComponent.stories.ts`). Solo render: ninguna story define `play` y no existe ningún `*.test.tsx`, así que ni `storybook/test` (`expect`, `userEvent`) ni el proyecto jsdom se ejercitan todavía.                                                            |
| `storybook build`              | ✅ Compila, incluido `src/ui/Configure.mdx` con sus imports de imágenes. Warning de Vite por chunks > 500 kB (`iframe` ≈1,1 MB, `blocks`, `axe`): esperable en un Storybook estático, no afecta al bundle de la librería.                                                                |
| `oxlint`                       | ✅ Sin diagnósticos. Oxlint no analiza `*.mdx`.                                                                                                                                                                                                                                          |
| `tsc -b`                       | ✅ Sin errores. **No cubre `.storybook/`** (§4.2) ni los `*.mdx`.                                                                                                                                                                                                                        |
| `prettier . --check`           | ✅ Sin archivos pendientes.                                                                                                                                                                                                                                                              |
| Carga de `vite.config.ts`      | ⚠️ Warning de Vite, emitido una vez por proyecto: `__dirname` no soportado por `configLoader: 'native'`, planeado como default en una major futura. Reemplazable por `import.meta.dirname` (Node ≥ 20.11, cubierto por ADR 0001), lo que elimina también el fallback `typeof __dirname`. |

Resuelto durante la instalación:

| Punto                                                | Resolución                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rangos de `storybook` y `@storybook/*`               | `~10.6.0`, conforme a ADR 0003.                                                                                                                                                                                                                                                                                                           |
| `@chromatic-com/storybook` como `latest`             | `~5.3.1`.                                                                                                                                                                                                                                                                                                                                 |
| Placeholder en `pnpm-workspace.yaml`                 | `allowBuilds.esbuild: true`. `esbuild@0.28.2` es dependencia directa de `storybook`; `true` permite su postinstall como fallback del binario.                                                                                                                                                                                             |
| Oxlint sobre `.storybook/` (7 errores)               | Overrides añadidos y `preview.tsx` → `preview.ts` (§4.1).                                                                                                                                                                                                                                                                                 |
| `tsc` y lint en `src/stories/` (6 + 4 errores)       | Stories renombradas a `.stories.ts` y componentes de ejemplo corregidos.                                                                                                                                                                                                                                                                  |
| Formato de archivos generados                        | `prettier --write` aplicado.                                                                                                                                                                                                                                                                                                              |
| Test en rojo `Page.stories.ts > Logged In`           | Story `LoggedIn` eliminada.                                                                                                                                                                                                                                                                                                               |
| `vitest.shims.d.ts` fuera de `tsc -b`                | Archivo eliminado; no hay imports de `vitest/browser` que lo requieran (§4.2).                                                                                                                                                                                                                                                            |
| Rangos `latest`, `^` y exacto en testing             | `vitest`, `@vitest/coverage-v8` y `@vitest/browser-playwright` en `~4.1.11`; `playwright` en `~1.63.0`. Lockfile regenerado sin cambios de versión resuelta.                                                                                                                                                                              |
| Rangos `~` sin respaldo en ADR 0003 ni en Dependabot | ADR 0003 actualizado: `vitest` + `@vitest/*`, `playwright` y `@chromatic-com/storybook` con política de solo parches. `dependabot.yml`: `ignore` por `update-types` (major + minor) para los cuatro y `groups` de parches para `vitest` + `@vitest/*` y `storybook` + `@storybook/*`, de modo que cada grupo se actualiza en un único PR. |
| Scaffolding en `src/stories/`                        | Directorio eliminado: `Button`, `Header`, `Page`, sus stories y CSS. `Configure.mdx` y `assets/` se reubicaron (ver desviaciones).                                                                                                                                                                                                        |

Desviaciones abiertas respecto a ADRs aceptados:

| Desviación                                                                                                                                                                                                                                                                                                                                                                | ADR afectado |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `src/ui/Configure.mdx`: es la página de bienvenida genérica de `storybook init` (guías de configuración, enlaces a Chromatic, Discord, YouTube), no documentación conceptual de LDS (§2.6). Aparece en el sidebar como `Configure your project` junto a los componentes.                                                                                                  | 0007         |
| `src/ui/shared/assets/` (16 imágenes, ≈756 kB) usadas solo por `Configure.mdx`. ADR 0004 reserva `ui/shared/` para lógica transversal (`hooks/`, `utils/`) promovida desde un segundo componente, y ubica los recursos estáticos globales en `src/assets/`. Además quedan dentro de `src/`, donde cualquier import accidental desde un componente los arrastra al bundle. | 0004         |
| `src/ui/base/test-component/`: carpeta en kebab-case (ADR 0004 prescribe PascalCase, `Button/`), `title: 'test/TestComponent'` fuera de la taxonomía `Base/…` (§2.6) y JSDoc copiado del ejemplo (`Primary UI component for user interaction`), que autodocs publica como descripción del componente.                                                                     | 0004, 0007   |
| `initialGlobals.backgrounds: { name: 'dark' }` en `preview.ts`: la clave válida es `value` (§2.3). El fondo inicial no se aplica.                                                                                                                                                                                                                                         | 0007         |

---

## 8. Pendientes y riesgos abiertos

Bloqueantes para el commit de la instalación:

1. **`Configure.mdx` y `src/ui/shared/assets/`:** eliminar ambos. Si se quiere
   una página de bienvenida, escribir un MDX propio de LDS (introducción,
   principios, cómo consumir la librería) sin imágenes del scaffolding y fuera
   de `ui/`. ADR 0004 no define todavía una ubicación para documentación
   conceptual: elegirla (p. ej. `src/docs/`, ya cubierta por el glob de §2.2) y
   registrarla en ADR 0004. Las imágenes que necesite van en
   `src/assets/images/`.
2. **`test-component`:** retirarlo o convertirlo en la primera primitiva real
   conforme a §2.6 (`src/ui/base/<Componente>/`, `title: 'Base/<Componente>'`,
   JSDoc propio).
3. **`preview.ts`:** `initialGlobals.backgrounds: { value: 'dark' }`.
4. **TypeScript:** incluir `.storybook/` en los proyectos de `tsc -b` (§4.2).

No bloqueantes:

- **`vite.config.ts`:** sustituir el cálculo de `dirname` por
  `import.meta.dirname` para eliminar el warning de `configLoader: 'native'`.
  Mover el comentario `// https://vite.dev/config/`, que tras la instalación
  quedó separado de `defineConfig` por los nuevos imports.
- **Cobertura real de story tests.** La suite actual solo verifica que las
  stories renderizan. La primera primitiva real debe incluir al menos una story
  con `play` (interacción + `expect` sobre `fn()`), para validar en CI la ruta
  `storybook/test` → `@vitest/expect@3.2.4` descrita en §2.1 antes de que
  existan decenas de componentes que dependan de ella.
- **Promover `a11y.test` a `'error'`** en cuanto exista el primer componente
  real en `src/ui/`. Mantener `'todo'` con componentes reales acumula
  violaciones silenciosas (mismo problema que los `warn` de Oxlint, ADR 0006
  §6). Excepciones puntuales por story con
  `parameters: { a11y: { test: 'todo' } }` y comentario que justifique.
- **Chromatic: decisión pendiente.** El addon está instalado pero sin proyecto
  ni token. Adoptarlo implica enviar el build de Storybook a un SaaS externo
  desde un repositorio privado, gestionar `CHROMATIC_PROJECT_TOKEN` como secret
  (y como Dependabot secret, ADR 0003) y coste por snapshot. Si no se adopta en
  el corto plazo, **retirar el addon** para reducir dependencias. Alternativa a
  evaluar: visual regression local con `toMatchScreenshot` de Vitest browser
  mode.
- **`@storybook/addon-mcp`:** el endpoint MCP se sirve desde el dev server.
  `storybook dev` escucha por defecto en todas las interfaces; en redes no
  confiables, arrancar con `--host localhost`.
- **CI:** no existe workflow. Debe incluir
  `playwright install --with-deps chromium` (cacheando `~/.cache/ms-playwright`
  por versión de `playwright`), `vitest run` y `build-storybook` como smoke test
  del build estático.
- **Publicación del Storybook estático:** sin decidir destino ni control de
  acceso (el repositorio es privado; GitHub Pages en repos privados expone el
  sitio públicamente salvo en planes Enterprise).
- **Scripts separados** `test:unit` / `test:storybook` para ejecutar el feedback
  loop rápido (jsdom) sin arrancar Chromium.
- **Decorators globales** en `preview` para `styles/main.scss` y tema, cuando
  exista la capa de `styles/` (LDS-31). Sustituir los colores hardcodeados de
  `backgrounds` por tokens.
- **ADR 0006 (tabla de reglas, `jsx-filename-extension`)** describe `as-needed`
  como "un `.tsx` sin JSX es válido", lo contrario de lo observado en la
  instalación (§4.1). Corregir la descripción.

---

## 9. Condiciones de invalidación

Esta decisión debe revisarse si:

- `@storybook/addon-vitest` no absorbe los breaking changes de Vitest 5
  (`storybookjs/storybook#35752`) en un plazo que haga insostenible permanecer
  en Vitest 4.1 (ADR 0001 §3.4).
- El tiempo de `pnpm test` o del cold start de `pnpm storybook` degrada el
  feedback loop de forma material a medida que crece el catálogo, y no se
  resuelve con sharding de Vitest, la migración de React Compiler a Oxc o
  `test:unit` separado.
- La tabla de props de autodocs resulta insuficiente para documentar la API
  pública con `react-docgen`, y `react-docgen-typescript` no es viable por
  rendimiento → evaluar documentación de API generada fuera de Storybook.
- Se publica LDS como paquete con exports por subpath (ADR 0004): las stories
  deberían importar desde el punto de entrada público para validar la API real,
  lo que puede requerir alias adicionales.
- Se adopta un servicio de visual regression: el diseño de story tests (§2.5)
  debe revisarse para no duplicar cobertura entre Vitest y el servicio.

---

## 10. Referencias

- Storybook — framework React + Vite:
  <https://storybook.js.org/docs/get-started/frameworks/react-vite>
- Storybook — Vitest addon:
  <https://storybook.js.org/docs/writing-tests/integrations/vitest-addon>
- Storybook — accessibility testing:
  <https://storybook.js.org/docs/writing-tests/accessibility-testing>
- Storybook — Component Story Format: <https://storybook.js.org/docs/api/csf>
- Storybook — backgrounds (API basada en globals):
  <https://storybook.js.org/docs/essentials/backgrounds>
- Storybook — `typescript.reactDocgen`:
  <https://storybook.js.org/docs/api/main-config/main-config-typescript#reactdocgen>
- Storybook — MCP addon: <https://storybook.js.org/docs/ai/mcp/overview>
- Vitest — browser mode: <https://vitest.dev/guide/browser/>
- Vitest — projects y `extends`: <https://vitest.dev/guide/projects>
- Playwright — instalación de browsers: <https://playwright.dev/docs/browsers>
- Vite — `configLoader`: <https://vite.dev/config/#configuring-vite>
