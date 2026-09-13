# ADR 0005 — Formateo de código con Prettier

| Campo               | Valor                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| Estado              | Aceptado                                                                               |
| Fecha               | 2026-09-12                                                                             |
| Ámbito              | Formateo de código fuente, configuración y documentación                               |
| Supersede a         | —                                                                                      |
| Relacionada con     | 0001 (versiones del stack), 0003 (baseline de seguridad), 0006 (Oxlint)                |
| Revisión programada | Al actualizar Prettier a un nuevo major o al cumplirse una _Condición de invalidación_ |

---

## 1. Contexto

LDS es un design system con superficie heterogénea: TS/TSX, SCSS, JSON, Markdown
(ADRs y guías) y YAML (`.github/`). Sin un formateador determinista:

- Los diffs de PR mezclan cambios semánticos con ruido de estilo (comillas,
  comas finales, saltos de línea), degradando la calidad de la revisión.
- Las discusiones de estilo se trasladan a la revisión de código en lugar de
  resolverse por herramienta.
- Los finales de línea divergen entre macOS/Linux y Windows.

El linter elegido (Oxlint, ver ADR 0006) no cubre formateo; se requiere una
herramienta dedicada con soporte para todos los lenguajes del repositorio.

---

## 2. Decisión

Se adopta **Prettier `3.9.x`** como único formateador del repositorio,
configurado mediante `.prettierrc.json`, `.prettierignore` y reforzado a nivel
Git por `.gitattributes`.

### 2.1 Opciones base (`.prettierrc.json`)

Todas las opciones se declaran de forma explícita, **incluidas las que coinciden
con el default de Prettier 3**. El objetivo es que la configuración sea
autodocumentada y que un cambio de defaults en un major futuro no altere el
output de forma silenciosa.

Solo dos opciones se desvían realmente del default:

| Opción        | Valor  | Default | Justificación                                                                                                                                                                       |
| ------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `printWidth`  | `100`  | `80`    | Firmas de componentes con props tipadas, JSX con varios atributos e imports con alias (`@/ui/...`) generan wrapping excesivo a 80 columnas. 100 mantiene legibilidad en split view. |
| `singleQuote` | `true` | `false` | Convención predominante en el ecosistema TS/React. No aplica a JSX (`jsxSingleQuote: false`) ni a SCSS (ver §2.2).                                                                  |

El resto se fija explícitamente con el valor por defecto:

| Opción                       | Valor         | Efecto relevante                                                                                                                                  |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabWidth` / `useTabs`       | `2` / `false` | Indentación con espacios.                                                                                                                         |
| `semi`                       | `true`        | Elimina la dependencia de ASI y los casos borde asociados (líneas que inician con `(`, `[` o template literal).                                   |
| `jsxSingleQuote`             | `false`       | Atributos JSX con comillas dobles, alineado con HTML.                                                                                             |
| `quoteProps`                 | `consistent`  | Si al menos una key de un objeto requiere comillas, se citan todas. Evita objetos con estilo mixto (p. ej. mapas de tokens).                      |
| `trailingComma`              | `all`         | Agregar un elemento a una lista, parámetro o import modifica una sola línea en el diff.                                                           |
| `bracketSpacing`             | `true`        | `{ a }` en lugar de `{a}`.                                                                                                                        |
| `bracketSameLine`            | `false`       | El `>` de un elemento JSX multilínea va en línea propia; separa visualmente props de children.                                                    |
| `objectWrap`                 | `preserve`    | Un objeto se mantiene multilínea si existe salto de línea entre `{` y la primera key. Respeta la intención del autor en objetos de configuración. |
| `arrowParens`                | `always`      | `(x) => x`. Agregar un parámetro o una anotación de tipo no reestructura la firma.                                                                |
| `proseWrap`                  | `preserve`    | Valor base; se sobreescribe para Markdown (§2.2).                                                                                                 |
| `htmlWhitespaceSensitivity`  | `css`         | Respeta el `display` por defecto de cada elemento para decidir si el whitespace es significativo.                                                 |
| `embeddedLanguageFormatting` | `auto`        | Formatea código embebido (p. ej. bloques de código en Markdown) cuando Prettier reconoce el lenguaje.                                             |
| `singleAttributePerLine`     | `false`       | Los atributos JSX se distribuyen por `printWidth`, no uno por línea de forma forzada.                                                             |
| `endOfLine`                  | `lf`          | Ver §2.4.                                                                                                                                         |

### 2.2 Overrides por tipo de archivo

| Patrón              | Opciones                                | Justificación                                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.json`, `*.jsonc` | `trailingComma: "none"`                 | Garantiza JSON estricto con independencia del parser que Prettier infiera (`json` o `jsonc`). Varios consumidores (`package.json` vía npm, `.oxlintrc.json`, `.prettierrc.json`) usan `JSON.parse` o parsers estrictos que rechazan comas finales. |
| `*.md`, `*.mdx`     | `proseWrap: "always"`, `printWidth: 80` | Wrap duro de prosa a 80 columnas: los diffs de documentación (ADRs, `CONTRIBUTING.md`) son por línea y no por párrafo completo, y el texto es legible en cualquier visor sin soft-wrap. Tablas y bloques de código no se ven afectados.            |
| `*.scss`, `*.css`   | `singleQuote: false`                    | Convención predominante en CSS/Sass y en la documentación oficial de Sass (`@use "..."`, `content: ""`).                                                                                                                                           |

Los patrones sin `/` en `overrides[].files` se evalúan contra el basename, por
lo que aplican a cualquier profundidad del árbol.

### 2.3 Exclusiones (`.prettierignore`)

Prettier 3 lee por defecto `.gitignore` y `.prettierignore`. Se mantiene un
`.prettierignore` explícito para no depender de que `.gitignore` cubra todos los
casos (p. ej. artefactos que sí se versionan pero no deben formatearse).

| Grupo                                                                        | Motivo                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node_modules`, `.pnp*`                                                      | Dependencias de terceros.                                                                        |
| Lockfiles (`package-lock.json`, `yarn.lock`, …)                              | El formato lo controla el package manager; reformatearlos genera diffs espurios en cada install. |
| `dist`, `dist-ssr`, `build`, `storybook-static`, `coverage`, `*.tsbuildinfo` | Artefactos generados.                                                                            |
| `.cache`, `.vite`, `.eslintcache`, `.stylelintcache`                         | Caches de herramientas.                                                                          |
| `*.min.js`, `*.min.css`, `*.map`                                             | Output minificado o generado.                                                                    |
| `public`                                                                     | Assets servidos tal cual (p. ej. `icons.svg`); el contenido debe preservarse byte a byte.        |
| `.env*`                                                                      | Archivos de entorno; no deben ser leídos ni reescritos por tooling.                              |
| `.claude`, `.idea`, `.vscode/*` (excepto `extensions.json`)                  | Configuración local de editor/agentes. `extensions.json` sí se versiona y se formatea.           |
| `.DS_Store`, `*.log`                                                         | Ruido de sistema.                                                                                |

### 2.4 Finales de línea: doble capa Git + Prettier

- **Git (`.gitattributes`)**: `* text=auto eol=lf` más declaraciones explícitas
  por extensión. Normaliza a LF en el índice y en el working tree, con
  independencia de `core.autocrlf` en la máquina del contribuidor. Los binarios
  se marcan como `binary` para evitar conversión y diff de texto.
- **Prettier (`endOfLine: "lf"`)**: `--check` falla si un archivo contiene CRLF
  (p. ej. generado por una herramienta externa o copiado desde otro entorno).

Git previene; Prettier detecta. Ninguna de las dos capas es suficiente por sí
sola: Git no valida archivos no versionados ni el output de generadores, y
Prettier no impide que Git reescriba finales de línea en checkout.

---

## 3. Comandos

```jsonc
// package.json
"prettier":     "prettier . --check --cache --log-level warn",
"prettier:fix": "prettier . --write --cache --log-level warn"
```

| Comando                | Uso                                   | Comportamiento                                                                 |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run prettier`     | Verificación (CI, pre-push, revisión) | No escribe. Lista los archivos no conformes y retorna exit code distinto de 0. |
| `npm run prettier:fix` | Corrección local                      | Reescribe in-place todos los archivos no conformes.                            |

### 3.1 Flags

| Flag               | Efecto                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.`                | Recorre el repositorio completo respetando `.gitignore` y `.prettierignore`. Los archivos con extensión no soportada se omiten.                                                                                                                                                |
| `--check`          | Modo solo lectura. Exit codes: `0` todo conforme, `1` al menos un archivo sin formatear, `2` error de Prettier (config inválida, error de parseo).                                                                                                                             |
| `--write`          | Formatea in-place.                                                                                                                                                                                                                                                             |
| `--cache`          | Omite archivos sin cambios desde la última ejecución. Cache en `node_modules/.cache/prettier/.prettier-cache`, estrategia `content` por defecto (hash de contenido, estable ante cambios de mtime por checkout). Se invalida al cambiar la versión de Prettier o las opciones. |
| `--log-level warn` | Suprime el listado de cada archivo procesado; solo se reportan archivos no conformes y errores. Mantiene el output de CI accionable.                                                                                                                                           |

### 3.2 Ejecución puntual

```bash
# Verificar o formatear un subconjunto
npx prettier src/ui --check
npx prettier docs/adr/0005-prettier.md --write

# Inspeccionar la configuración efectiva resuelta para un archivo (overrides incluidos)
npx prettier --find-config-path src/main.tsx
npx prettier --file-info docs/adr/0005-prettier.md

# Ejecución sin cache (p. ej. para descartar un falso negativo por cache corrupta)
npx prettier . --check
```

---

## 4. Relación con Oxlint

- **No se requiere un equivalente a `eslint-config-prettier`.** La configuración
  de Oxlint (ADR 0006) no habilita la categoría `style` completa ni reglas de
  formateo (indentación, comillas, espaciado). Las reglas estilísticas que sí se
  habilitan operan sobre semántica, no sobre layout.
- **`eslint/curly` se configura con `"all"`**, que es la única variante
  compatible con Prettier: las variantes `multi-line`/`multi-or-nest` dependen
  del layout del código, que Prettier puede alterar.
- **Orden de ejecución al corregir:** `npm run lint:fix` →
  `npm run prettier:fix`. Los autofixes del linter pueden producir código no
  formateado; Prettier debe ser el último paso de escritura.

---

## 5. Alternativas consideradas

| Alternativa                              | Por qué se descartó                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas de formateo en el linter          | Oxlint no cubre formateo. El enfoque "linter como formateador" (p. ej. `@stylistic` en ESLint) es más lento, requiere configurar decenas de reglas y no cubre SCSS, Markdown ni YAML.               |
| Formateador del toolchain de Oxc (Oxfmt) | Alineado con el stack VoidZero (ADR 0001), pero se prioriza un formateador con output estable y probado sobre todos los lenguajes del repositorio. Se reevalúa según _Condiciones de invalidación_. |
| Biome (lint + format)                    | Duplica la responsabilidad de linting ya asignada a Oxlint (ADR 0001) e introduce una segunda cadena de reglas a mantener.                                                                          |
| Solo `.editorconfig`                     | Cubre indentación y finales de línea, pero no comillas, comas finales, wrapping ni estructura de JSX. No es determinista.                                                                           |
| Defaults de Prettier sin configuración   | Válido, pero implícito: un cambio de defaults en un major altera el output sin cambios en el repositorio, y `printWidth: 80` resulta restrictivo para TSX.                                          |

---

## 6. Consecuencias

**Positivas**

- Formato determinista y no negociable: las discusiones de estilo salen de la
  revisión de código.
- Diffs mínimos en listas, parámetros, imports y documentación.
- Finales de línea garantizados en dos capas independientes.
- Ejecuciones incrementales rápidas gracias a `--cache`.

**Negativas / costos aceptados**

- El commit de adopción reformateó el repositorio completo, lo que afecta
  `git blame` en esas líneas. Mitigable registrando el hash del commit en
  `.git-blame-ignore-revs` (pendiente, §7).
- `proseWrap: "always"` en Markdown implica que editar una frase puede reflujar
  el párrafo completo, generando diffs de varias líneas por un cambio pequeño.
- La cache vive en `node_modules/.cache`; un `npm ci` la elimina y la primera
  ejecución posterior es completa.

---

## 7. Pendientes y riesgos abiertos

- **Versión no fijada.** `package.json` declara `"prettier": "^3.9.6"` y
  Prettier no está en la lista `ignore` de `.github/dependabot.yml`. Prettier
  puede introducir cambios de output en releases minor, lo que haría fallar
  `npm run prettier` en CI sin cambios en el código. Recomendación: fijar
  versión exacta (`npm i -D -E prettier@3.9.6`) y actualizar en PR dedicado que
  incluya el reformateo resultante, en línea con la política de ADR 0003.
- **Sin enforcement automatizado.** No existe workflow de CI ni hook de
  pre-commit que ejecute `npm run prettier`. Mientras no exista, la conformidad
  depende de ejecución manual.
- **Estado actual no conforme.** `src/ui/index.ts` no pasa `npm run prettier`
  (comillas dobles y ausencia de newline final).
- **Integración con editor.** No existe `.vscode/extensions.json` ni
  `.vscode/settings.json` que recomienden la extensión de Prettier y
  `formatOnSave`, pese a que `.prettierignore` ya contempla `extensions.json`
  como archivo versionable.
- **`.git-blame-ignore-revs`** para el commit de reformateo masivo (`5802d6d`).

---

## 8. Condiciones de invalidación

Esta decisión debe revisarse si:

- Oxfmt (u otro formateador del toolchain de Oxc) alcanza paridad de output y de
  cobertura con Prettier para TS/TSX, SCSS, JSON, Markdown y YAML, lo que
  permitiría consolidar el toolchain y reducir superficie de dependencias.
- Se adopta un plugin de Prettier (p. ej. ordenamiento de imports o de clases)
  que entre en conflicto con reglas de Oxlint (`import/first`,
  `import/newline-after-import`, `import/no-duplicates`).
- El tiempo de `npm run prettier` en CI se vuelve un cuello de botella
  significativo frente al resto del pipeline.

---

## 9. Referencias

- Prettier — opciones: <https://prettier.io/docs/options>
- Prettier — CLI (`--check`, `--cache`, exit codes):
  <https://prettier.io/docs/cli>
- Prettier — archivo de configuración y overrides:
  <https://prettier.io/docs/configuration>
- Prettier — ignorar archivos: <https://prettier.io/docs/ignore>
- Prettier — rationale y relación con linters:
  <https://prettier.io/docs/integrating-with-linters>
- Git — `gitattributes` (`text`, `eol`):
  <https://git-scm.com/docs/gitattributes>
