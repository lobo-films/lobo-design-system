# ADR 0006 — Análisis estático con Oxlint

| Campo               | Valor                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Estado              | Aceptado                                                                                               |
| Fecha               | 2026-09-12                                                                                             |
| Ámbito              | Linting de TS/TSX/JS: correctness, convenciones de TypeScript, React, módulos y accesibilidad          |
| Supersede a         | —                                                                                                      |
| Relacionada con     | 0001 (versiones del stack), 0003 (baseline de seguridad), 0004 (estructura), 0005 (Prettier)           |
| Revisión programada | Al actualizar `oxlint` (versión congelada por ADR 0003) o al cumplirse una _Condición de invalidación_ |

---

## 1. Contexto

ADR 0001 fijó Oxlint como linter del proyecto por dos motivos: pertenece al
toolchain de VoidZero sobre el que se construye el stack (Vite 8 / Rolldown /
Oxc) y expone, en la categoría `correctness`, las reglas derivadas de los passes
de validación de React Compiler. Ese ADR fijó la versión pero no la
configuración.

Este documento formaliza la configuración de `.oxlintrc.json`: qué plugins se
habilitan, qué severidad se asigna por categoría, qué reglas se activan de forma
explícita y por qué, y cómo se ejecuta.

Restricciones de partida:

- LDS es una librería de componentes que se ejecuta en browser (ADR 0004). El
  código de `src/` no debe depender de APIs de Node.
- La API pública se expone vía barrels (`ui/index.ts`, `index.ts` por
  componente), lo que condiciona las reglas de módulos.
- `tsconfig.base.json` habilita `strict`, `verbatimModuleSyntax`,
  `noUnusedLocals`, `noUnusedParameters` y `erasableSyntaxOnly`. El linter no
  debe duplicar sin motivo lo que ya garantiza `tsc`, y sus reglas deben ser
  coherentes con esas opciones.
- El formateo es responsabilidad exclusiva de Prettier (ADR 0005).

---

## 2. Decisión

Se adopta **Oxlint `1.82.0`** sin ESLint en paralelo, con la configuración
descrita a continuación.

### 2.1 Plugins

```json
"plugins": ["eslint", "typescript", "react", "jsx-a11y", "import", "unicorn", "oxc", "promise"]
```

> **Importante:** declarar `plugins` **reemplaza** el set base de Oxlint, no lo
> extiende. El array debe contener todos los plugins deseados.

| Plugin       | Motivo                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `eslint`     | Reglas core portadas de ESLint.                                                                                                     |
| `typescript` | Port de `typescript-eslint` (solo reglas sin información de tipos; ver §6).                                                         |
| `react`      | Incluye `rules-of-hooks` y `exhaustive-deps` (equivalente a `eslint-plugin-react-hooks`) y `only-export-components` (Fast Refresh). |
| `jsx-a11y`   | Accesibilidad. Crítico en un design system: un defecto a11y en una primitiva se propaga a todos los consumidores.                   |
| `import`     | Higiene de módulos, ciclos y convenciones de export.                                                                                |
| `unicorn`    | APIs modernas del lenguaje y del DOM.                                                                                               |
| `oxc`        | Reglas propias de Oxc.                                                                                                              |
| `promise`    | Uso correcto de Promises.                                                                                                           |
| `vitest`     | Habilitado solo en el override de tests (§2.6).                                                                                     |

No se habilitan `react-perf`, `jest`, `nextjs`, `jsdoc` ni `node` por no aplicar
al proyecto.

### 2.2 Entorno y alcance

| Clave                                   | Valor                                                          | Motivo                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `env`                                   | `browser: true`, `es2024: true`                                | Globals de DOM y ES2024. Los archivos de configuración y `scripts/` cambian a entorno Node vía override (§2.6).          |
| `ignorePatterns`                        | `dist/**`, `dist-ssr/**`, `coverage/**`, `storybook-static/**` | Artefactos generados.                                                                                                    |
| `options.reportUnusedDisableDirectives` | `"error"`                                                      | Un `// oxlint-disable` que ya no suprime nada es un error. Evita la acumulación de supresiones obsoletas tras refactors. |

### 2.3 Categorías y severidad

| Categoría     | Severidad | Criterio                                                                                                                            |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `correctness` | `error`   | Código objetivamente incorrecto o inútil. Incluye las reglas derivadas de React Compiler. El default de Oxlint es `warn`; se eleva. |
| `suspicious`  | `error`   | Patrones con alta probabilidad de bug. En código de librería el costo de un falso positivo es menor que el de un bug distribuido.   |
| `perf`        | `warn`    | Señal útil, pero con suficientes casos legítimos como para no bloquear.                                                             |
| `pedantic`    | —         | No se habilita en bloque: tasa de falsos positivos alta. Las reglas relevantes se activan individualmente.                          |
| `style`       | —         | No se habilita en bloque para no solaparse con Prettier (ADR 0005). Reglas puntuales se activan individualmente.                    |
| `restriction` | —         | Por definición son reglas opt-in (p. ej. `no-default-export`, `no-cycle`); se activan individualmente.                              |
| `nursery`     | —         | Reglas inestables. No se usan.                                                                                                      |

**Semántica de severidad:** con el script actual, solo `error` produce exit code
distinto de 0. Los `warn` se reportan pero no bloquean (ver §3.2 y §7).

### 2.4 Reglas explícitas

Las reglas explícitas activan reglas fuera de las categorías habilitadas o
ajustan opciones/severidad de reglas que ya lo están. Se agrupan por intención.

#### Flujo de control y claridad (`eslint`)

| Regla(s)                                                                                                            | Configuración / motivo                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `curly`                                                                                                             | `"all"`. Única variante compatible con Prettier (ADR 0005 §4).                                                                                                     |
| `eqeqeq`                                                                                                            | `"always"` con `null: "ignore"`: permite `x == null` como check idiomático de `null \| undefined`.                                                                 |
| `no-else-return` (`allowElseIf: false`), `no-lonely-if`, `no-nested-ternary`, `no-useless-return`                   | Fomentan early return y ramas planas. `unicorn/no-nested-ternary` se desactiva para evitar doble reporte con variante más permisiva.                               |
| `max-depth` (4), `max-params` (4)                                                                                   | `warn`. Señal de que un componente o función debe descomponerse o recibir un objeto de opciones.                                                                   |
| `default-case-last`, `no-fallthrough`, `no-case-declarations`                                                       | Correctitud de `switch`. Complementan `noFallthroughCasesInSwitch` de `tsc`.                                                                                       |
| `array-callback-return`, `require-await`, `no-return-assign`, `no-self-compare`, `yoda`                             | Bugs comunes de baja visibilidad.                                                                                                                                  |
| `no-param-reassign` (`props: true`)                                                                                 | Prohíbe mutar parámetros **y sus propiedades**. Protege contra mutación de props/objetos recibidos, incompatible con el modelo de React Compiler.                  |
| `no-implicit-coercion`, `no-new-wrappers`, `radix`, `prefer-template`, `object-shorthand`, `prefer-const`, `no-var` | Conversiones y sintaxis explícitas y modernas.                                                                                                                     |
| `no-throw-literal`, `prefer-promise-reject-errors`                                                                  | Solo se lanzan/rechazan instancias de `Error` (stack trace preservado).                                                                                            |
| `no-console`                                                                                                        | `warn`, permite `console.warn` y `console.error` (avisos de desarrollo para consumidores de la librería).                                                          |
| `no-alert`, `no-empty`, `no-prototype-builtins`, `no-redeclare`                                                     | Higiene básica.                                                                                                                                                    |
| `no-unused-vars`                                                                                                    | Ignora identificadores con prefijo `_` (args, vars, `catch`, destructuring de arrays) e `ignoreRestSiblings` para omitir props vía `const { a, ...rest } = props`. |
| `no-underscore-dangle`                                                                                              | `off`: la convención `_` es necesaria para la regla anterior.                                                                                                      |

#### TypeScript (`typescript`)

| Regla(s)                                                                                                                                                                                                                                                                                                                        | Configuración / motivo                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consistent-type-imports` + `no-import-type-side-effects` + `import/consistent-type-specifier-style: prefer-top-level`                                                                                                                                                                                                          | Coherentes con `verbatimModuleSyntax`: con esa opción `import { type A } from 'x'` se emite como `import 'x'` (side effect residual). Forzar `import type { A }` a nivel de declaración elimina el import del output. |
| `consistent-type-definitions`                                                                                                                                                                                                                                                                                                   | `"interface"`. Mensajes de error más legibles, `extends` explícito para props que extienden atributos HTML nativos. `type` queda para uniones, mapped y conditional types.                                            |
| `array-type`                                                                                                                                                                                                                                                                                                                    | `"array-simple"`: `string[]` para tipos simples, `Array<A \| B>` para compuestos.                                                                                                                                     |
| `ban-ts-comment`                                                                                                                                                                                                                                                                                                                | Prohíbe `@ts-ignore` y `@ts-nocheck`; `@ts-expect-error` solo con descripción de al menos 10 caracteres. Refuerzo: `prefer-ts-expect-error` (la supresión falla cuando el error desaparece).                          |
| `no-explicit-any`                                                                                                                                                                                                                                                                                                               | `error`. En la API pública de una librería, `any` se propaga a los tipos del consumidor.                                                                                                                              |
| `no-non-null-assertion`                                                                                                                                                                                                                                                                                                         | `warn`. Se prefiere guard explícito con error descriptivo (p. ej. el montaje de `#root` en `src/main.tsx`).                                                                                                           |
| `no-namespace`, `no-require-imports`, `no-dynamic-delete`, `no-empty-object-type`, `no-invalid-void-type`, `no-unsafe-function-type`, `prefer-function-type`, `no-inferrable-types`, `consistent-indexed-object-style`, `consistent-type-assertions`, `adjacent-overload-signatures`, `no-non-null-asserted-nullish-coalescing` | Higiene de tipos. `no-namespace` es además coherente con `erasableSyntaxOnly`.                                                                                                                                        |

#### React (`react`)

| Regla(s)                                                                                                                                                                                                           | Configuración / motivo                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules-of-hooks`, `exhaustive-deps`                                                                                                                                                                                | `error`. Prerrequisito para que React Compiler optimice correctamente.                                                                          |
| `only-export-components`                                                                                                                                                                                           | `warn`, `allowConstantExport: true`. Preserva Fast Refresh en dev y en Storybook.                                                               |
| `react-in-jsx-scope`                                                                                                                                                                                               | `off`. Innecesaria con el JSX transform automático (`jsx: react-jsx`).                                                                          |
| `button-has-type`                                                                                                                                                                                                  | `<button>` sin `type` es `submit` por defecto; en un componente reutilizable dentro de un `<form>` del consumidor provoca submits accidentales. |
| `jsx-no-target-blank`                                                                                                                                                                                              | Exige `rel="noreferrer"` en `target="_blank"` (reverse tabnabbing).                                                                             |
| `no-danger`                                                                                                                                                                                                        | Prohíbe `dangerouslySetInnerHTML` (XSS).                                                                                                        |
| `no-array-index-key`                                                                                                                                                                                               | El índice como `key` rompe la reconciliación y el estado de componentes en listas reordenables.                                                 |
| `jsx-filename-extension`                                                                                                                                                                                           | JSX solo en `.tsx` (`as-needed`: un `.tsx` sin JSX es válido).                                                                                  |
| `checked-requires-onchange-or-readonly`, `hook-use-state`                                                                                                                                                          | Inputs controlados correctos; par `[value, setValue]` en `useState`.                                                                            |
| `jsx-boolean-value` (`never`), `jsx-curly-brace-presence` (`never`), `jsx-fragments` (`syntax`), `jsx-no-useless-fragment`, `self-closing-comp`, `jsx-pascal-case`, `no-unescaped-entities`, `no-unknown-property` | Consistencia y correctitud de JSX.                                                                                                              |

#### Módulos (`import`)

| Regla                                                                                 | Configuración / motivo                                                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-default-export`                                                                   | Solo named exports. Nombres estables entre definición, barrel y consumidor; renombres detectables por tooling. Excepciones en §2.6.                       |
| `no-cycle`                                                                            | Los barrels (ADR 0004) facilitan ciclos accidentales (`Card` → `ui/index.ts` → `Card`), que en ESM producen bindings `undefined` en tiempo de evaluación. |
| `no-unassigned-import`                                                                | Prohíbe imports por side effect, salvo `**/*.css` y `**/*.scss`. Relevante para `sideEffects` y tree-shaking del paquete.                                 |
| `no-duplicates`, `first`, `newline-after-import`, `no-mutable-exports`, `no-commonjs` | Higiene de ESM.                                                                                                                                           |
| `oxc/no-barrel-file`                                                                  | `off`. La estructura de ADR 0004 prescribe barrels de forma deliberada.                                                                                   |

#### Otras (`unicorn`, `oxc`, `promise`)

| Regla(s)                                                                                                                                                                                                                                               | Configuración / motivo                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unicorn/filename-case`                                                                                                                                                                                                                                | `camelCase`, `PascalCase` o `kebab-case`. Admite `Button.tsx`, `useMediaQuery.ts` y `vite-env.d.ts`; rechaza `snake_case` y variantes mixtas (ADR 0004). |
| `unicorn/prefer-*` (`at`, `includes`, `query-selector`, `modern-dom-apis`, `add-event-listener`, `keyboard-event-key`, `structured-clone`, `string-replace-all`, `spread`, `number-properties`, `date-now`, `optional-catch-binding`, `node-protocol`) | APIs modernas equivalentes y más expresivas.                                                                                                             |
| `unicorn/error-message`, `throw-new-error`, `no-instanceof-array`, `no-typeof-undefined`, `no-useless-undefined`, `no-document-cookie`, `require-array-join-separator`, `switch-case-braces`, `no-abusive-eslint-disable`                              | Correctitud y explicitud. `no-abusive-eslint-disable` prohíbe supresiones sin nombre de regla.                                                           |
| `unicorn/consistent-function-scoping`                                                                                                                                                                                                                  | `off`. Genera ruido con closures definidos dentro de componentes y hooks, que son el patrón normal en React.                                             |
| `oxc/no-const-enum`                                                                                                                                                                                                                                    | `const enum` no es compatible con compilación aislada por archivo (Oxc/Rolldown) ni con `erasableSyntaxOnly`.                                            |
| `promise/no-nesting`, `no-return-wrap`, `param-names`                                                                                                                                                                                                  | Uso correcto de Promises.                                                                                                                                |
| `promise/prefer-await-to-then`                                                                                                                                                                                                                         | `warn`. Preferencia por `async/await`, sin bloquear casos legítimos.                                                                                     |

### 2.5 Archivos de configuración

Se versiona el `$schema` (`./node_modules/oxlint/configuration_schema.json`), lo
que da validación y autocompletado en el editor alineados con la versión
instalada. Oxlint rechaza reglas desconocidas en la configuración
(`Rule '<name>' not found in plugin '<plugin>'`, exit code `1`), por lo que un
typo en el nombre de una regla falla la ejecución en lugar de ignorarse.

### 2.6 Overrides

| Archivos                                                               | Cambio                                                                             | Motivo                                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/**`                                                               | `import/no-nodejs-modules: error`                                                  | El código de la librería se ejecuta en browser; un import de `node:*` rompe al consumidor.                  |
| `*.config.{js,mjs,cjs,ts,mts}`, `**/*.stories.{ts,tsx}`, `src/App.tsx` | `import/no-default-export: off`                                                    | Vite/herramientas y el formato CSF de Storybook requieren default export. `App.tsx` es el playground local. |
| `*.config.{js,mjs,cjs,ts,mts}`, `scripts/**`                           | `env: { browser: false, node: true }`                                              | Código ejecutado en Node.                                                                                   |
| `**/*.{test,spec}.{ts,tsx}`, `**/__tests__/**`                         | Plugin `vitest`; `typescript/no-non-null-assertion: off`; `eslint/max-params: off` | En tests, `!` sobre resultados de queries es aceptable y los helpers parametrizados son legítimos.          |

Los overrides de Storybook y Vitest se declaran por adelantado respecto a la
instalación de esas dependencias (ADR 0001); no tienen efecto hasta que existan
archivos que coincidan.

---

## 3. Comandos

```jsonc
// package.json
"lint":     "oxlint",
"lint:fix": "oxlint --fix"
```

| Comando         | Uso                      | Comportamiento                                                                                           |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `pnpm lint`     | Verificación (CI, local) | Descubre `.oxlintrc.json` en la raíz y analiza el repositorio. Exit code `1` si hay al menos un `error`. |
| `pnpm lint:fix` | Corrección local         | Aplica únicamente los fixes marcados como seguros. Reporta lo que no pudo corregir.                      |

### 3.1 Niveles de autofix

| Flag                | Alcance                                                             | Uso recomendado                          |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `--fix`             | Fixes seguros (no alteran semántica).                               | Uso habitual (`lint:fix`).               |
| `--fix-suggestions` | Además aplica sugerencias que **pueden cambiar el comportamiento**. | Solo manual, revisando el diff completo. |
| `--fix-dangerously` | Además aplica fixes marcados como peligrosos.                       | No recomendado.                          |

Tras cualquier autofix: `pnpm prettier:fix` (ADR 0005 §4).

### 3.2 Flags útiles para diagnóstico y CI

```bash
# Fallar también ante warnings (recomendado para CI, ver §7)
pnpm exec oxlint --deny-warnings

# Umbral de warnings tolerados
pnpm exec oxlint --max-warnings=0

# Reportar solo errores
pnpm exec oxlint --quiet

# Output estructurado (json, github, checkstyle, junit, ...)
pnpm exec oxlint -f json
pnpm exec oxlint -f github  # anotaciones inline en PRs de GitHub Actions
# Catálogo de reglas disponibles (categoría, fixability, type-aware)
pnpm exec oxlint --rules

# Coste por regla
pnpm exec oxlint --debug=timings

# Configuración efectiva resuelta (sin ejecutar lint)
pnpm exec oxlint --print-config

# Archivos que se analizarían tras aplicar ignores
pnpm exec oxlint --debug=files

# Lint de un subconjunto
pnpm exec oxlint src/ui/base/Button
```

---

## 4. División de responsabilidades

| Herramienta         | Responsabilidad                                                                                        | Comando          |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| `tsc -b`            | Correctitud de tipos, incluyendo `noUnusedLocals`/`noUnusedParameters` y `noFallthroughCasesInSwitch`. | `pnpm typecheck` |
| Oxlint              | Correctitud semántica sin tipos, convenciones, React/hooks, a11y, módulos.                             | `pnpm lint`      |
| Prettier (ADR 0005) | Layout del código. Oxlint no emite diagnósticos de formato.                                            | `pnpm prettier`  |

Secuencia de verificación completa:

```bash
pnpm typecheck && pnpm lint && pnpm prettier
```

---

## 5. Alternativas consideradas

| Alternativa                                                     | Por qué se descartó                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint + `typescript-eslint` + plugins equivalentes             | Ecosistema más maduro y reglas type-aware completas, pero órdenes de magnitud más lento, especialmente con `import/no-cycle` y type-aware sobre una librería de componentes en crecimiento. Aumenta significativamente el árbol de dependencias de desarrollo (superficie de supply chain, ADR 0003). |
| Oxlint + ESLint en paralelo (`eslint-plugin-oxlint`)            | Cubre reglas type-aware y plugins sin port, a costa de mantener dos configuraciones sincronizadas y dos cadenas de dependencias. No se justifica mientras las reglas ausentes no sean bloqueantes (§6).                                                                                               |
| Habilitar `pedantic`/`style` en bloque y desactivar excepciones | Configuración por exclusión: cada actualización de Oxlint puede incorporar reglas nuevas a esas categorías y romper CI sin cambios en el código. Se prefiere opt-in explícito.                                                                                                                        |

---

## 6. Consecuencias

**Positivas**

- Lint del repositorio completo en milisegundos (329 reglas activas sobre el
  estado actual), viable en cada guardado, pre-commit y CI.
- Una única herramienta y configuración para JS/TS, React, a11y e imports.
- Reglas de React Compiler integradas en `correctness`, bloqueantes por
  severidad.
- Configuración opt-in: el conjunto de reglas activas es explícito y auditable.

**Negativas / costos aceptados**

- **Sin reglas type-aware.** No se usa `--type-aware` (requiere
  `oxlint-tsgolint`). Quedan fuera, entre otras,
  `typescript/no-floating-promises` y `typescript/no-misused-promises`. Es la
  principal pérdida frente a `typescript-eslint`.
- **Sin enforcement de fronteras entre componentes.** ADR 0004 deja como riesgo
  abierto la importación desde carpetas internas de otro componente
  (`ComponentB/hooks/`). Esta configuración no lo cubre.
- **Los `warn` no bloquean** con el script actual; sin disciplina o
  `--deny-warnings` en CI tienden a acumularse.
- Reglas con paridad parcial respecto a sus equivalentes de ESLint: algunas
  opciones pueden no estar implementadas. Validar contra la documentación de
  cada regla antes de asumir comportamiento idéntico.

---

## 7. Pendientes y riesgos abiertos

- **Rango de versión inconsistente con ADR 0003.** `package.json` declara
  `"oxlint": "^1.81.0"`, mientras ADR 0003 exige versión exacta `1.82.0` (sin
  `^`) y Dependabot la congela. El lockfile resuelve `1.82.0`, pero un
  `pnpm install` sin lockfile o un `pnpm update` puede traer otra minor con
  reglas nuevas en `correctness`/`suspicious`, que aquí son `error`. Corregir
  con `pnpm add -D -E oxlint@1.82.0`.
- **Sin workflow de CI ni hook de pre-commit** que ejecute `pnpm lint`.
  Recomendación: `oxlint --deny-warnings -f github` en CI.
- **Evaluar `--type-aware`** con `oxlint-tsgolint` una vez estable, empezando
  por `no-floating-promises` y `no-misused-promises`.
- **Fronteras de módulos (ADR 0004):** evaluar `eslint/no-restricted-imports`
  (disponible en Oxlint, categoría `restriction`) con patrones que prohíban
  `**/ui/*/*/{hooks,components,assets}/**` desde fuera del componente.
- **Placeholder en `src/ui/index.ts`** (`console.warn("Hello world")`): no
  infringe lint (`console.warn` está permitido) pero no pertenece a la API
  pública del barrel.

---

## 8. Condiciones de invalidación

Esta decisión debe revisarse si:

- Se requieren reglas type-aware como bloqueantes y el soporte de `--type-aware`
  en Oxlint no es estable o no cubre las reglas necesarias.
- Se necesita un plugin sin equivalente en Oxlint (p. ej. reglas específicas de
  Storybook o de testing-library) y los `jsPlugins` de Oxlint no lo soportan, lo
  que obligaría a introducir ESLint en paralelo.
- Una actualización de Oxlint cambia el set de reglas en `correctness` o
  `suspicious` de forma que la severidad `error` en bloque genere falsos
  positivos recurrentes.
- Se detectan en revisión violaciones recurrentes de las fronteras de ADR 0004,
  lo que haría obligatoria la regla de §7.

---

## 9. Referencias

- Oxlint — configuración: <https://oxc.rs/docs/guide/usage/linter/config.html>
- Oxlint — plugins soportados:
  <https://oxc.rs/docs/guide/usage/linter/plugins.html>
- Oxlint — catálogo de reglas:
  <https://oxc.rs/docs/guide/usage/linter/rules.html>
- Oxlint — CLI: <https://oxc.rs/docs/guide/usage/linter/cli.html>
- Oxlint — linting type-aware:
  <https://oxc.rs/docs/guide/usage/linter/type-aware.html>
- Oxc — soporte de React Compiler en Oxlint:
  <https://oxc.rs/blog/2026-08-18-react-compiler-support.html>
- TypeScript — `verbatimModuleSyntax`:
  <https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax>
