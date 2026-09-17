# Getting started — Lobo Design System

Esta guía lleva a un nuevo colaborador desde cero hasta su primer PR mergeable:
accesos, toolchain, instalación, ejecución, configuración del editor y flujo de
contribución.

Es una guía operativa. El _porqué_ de cada decisión está en los [ADR](./adr/) y
las reglas normativas de ramas, commits y PRs están en
[CONTRIBUTING.md](./CONTRIBUTING.md). Para la visión general del proyecto,
consulta el [README](../README.md).

---

## Contenido

- [TL;DR](#tldr)
- [1. Requisitos](#1-requisitos)
- [2. Instalación](#2-instalación)
- [3. Ejecutar el proyecto](#3-ejecutar-el-proyecto)
- [4. Configuración del editor](#4-configuración-del-editor)
- [5. Primer aporte: flujo completo](#5-primer-aporte-flujo-completo)
- [6. Solución de problemas](#6-solución-de-problemas)
- [7. Lecturas recomendadas](#7-lecturas-recomendadas)

---

## TL;DR

```bash
git clone git@github.com:lobo-films/lobo-design-system.git && cd lobo-design-system
nvm install && nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

pnpm typecheck && pnpm lint && pnpm prettier && pnpm test && pnpm build   # verificación
pnpm storybook                                                            # http://localhost:6006
```

Si todos los comandos terminan con exit code `0`, el entorno está listo y puedes
saltar a la [§5](#5-primer-aporte-flujo-completo).

---

## 1. Requisitos

### 1.1 Accesos

| Acceso                                         | Para qué                                                                           | Cómo obtenerlo                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Organización `lobo-films` en GitHub            | Clonar el repositorio (privado), abrir PRs y ver los checks.                       | Solicitarlo al owner de la organización (`@Hipstha`). |
| Jira, proyecto `LDS` (`hipstha.atlassian.net`) | Todo trabajo parte de un ticket `LDS-N`. Rama, commit inicial y PR lo referencian. | Solicitarlo al owner del proyecto.                    |
| Fuente de diseño `Design System v2.0 Lobo`     | Los valores implementados (tokens, espaciados, colores) se verifican contra ella.  | Solicitarlo al owner del proyecto.                    |

### 1.2 Software

| Herramienta                 | Versión                        | Verificación           | Notas                                                                                                   |
| --------------------------- | ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Git                         | Reciente                       | `git --version`        | `.gitattributes` normaliza todos los archivos de texto a LF, con independencia del sistema operativo.   |
| Gestor de versiones de Node | nvm, fnm o Volta               | `nvm --version`        | Cualquiera que lea `.nvmrc`.                                                                            |
| Node.js                     | `24` (`.nvmrc`)                | `node -v` → `v24.x`    | CI usa el último `24.x`. Vite 8 funciona con 20.19+ o 22.12+, pero el proyecto solo se verifica en 24.  |
| Corepack                    | Incluido en Node 24            | `corepack --version`   | Provee pnpm en la versión exacta de `packageManager`.                                                   |
| pnpm                        | `12.4.1` (`packageManager`)    | `pnpm -v` → `12.4.1`   | **No lo instales con `npm i -g`**: una versión distinta puede reescribir el lockfile con otro formato.  |
| Chromium (Playwright)       | El que fija `playwright ~1.63` | Se descarga en la §2.4 | Lo necesita el proyecto `storybook` de Vitest. Cada minor de Playwright trae otra revisión de Chromium. |
| GitHub CLI (opcional)       | Reciente                       | `gh --version`         | Facilita abrir PRs y consultar checks desde la terminal.                                                |

### 1.3 Autenticación SSH con GitHub

```bash
ssh -T git@github.com
# Hi <usuario>! You've successfully authenticated, but GitHub does not provide shell access.
```

Si falla, configura una llave SSH en tu cuenta de GitHub antes de continuar.

---

## 2. Instalación

### 2.1 Clonar

```bash
git clone git@github.com:lobo-films/lobo-design-system.git
cd lobo-design-system
```

### 2.2 Toolchain

```bash
nvm install        # instala la versión de .nvmrc si no existe
nvm use            # la activa en la shell actual
corepack enable    # expone el binario pnpm gestionado por Corepack
pnpm -v            # debe imprimir 12.4.1
```

La primera vez, Corepack pide confirmación para descargar pnpm. En entornos no
interactivos, exporta `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`.

### 2.3 Dependencias

```bash
pnpm install --frozen-lockfile
```

- **`--frozen-lockfile`** es lo mismo que ejecuta CI: falla si `package.json` y
  `pnpm-lock.yaml` no coinciden, en lugar de re-resolver en silencio. No
  regeneres el lockfile en una rama cuyo objetivo no sea cambiar dependencias.
- **Scripts de ciclo de vida restringidos.** pnpm solo ejecuta los `postinstall`
  de los paquetes autorizados en `allowBuilds` (`pnpm-workspace.yaml`); hoy solo
  está autorizado `esbuild`. Si una dependencia nueva necesita build, añádela
  explícitamente en el mismo PR y justifícalo: es una decisión de seguridad
  ([ADR 0009 §2.8](./adr/0009-continuous-integration.md)).
- **No uses `pnpm clean-install` como remedio genérico.** Borra el lockfile y
  re-resuelve todo el árbol.

### 2.4 Navegador para story tests

```bash
pnpm exec playwright install chromium
```

En Linux sin las librerías de sistema de Chromium, usa
`pnpm exec playwright install --with-deps chromium` (requiere `sudo`). Vuelve a
ejecutarlo cada vez que un PR actualice `playwright`.

### 2.5 Verificar la instalación

Ejecuta la misma secuencia que CI:

```bash
pnpm typecheck && pnpm lint && pnpm prettier && pnpm test && pnpm build
```

| Paso        | Resultado esperado                                                                      |
| ----------- | --------------------------------------------------------------------------------------- |
| `typecheck` | Sin salida, exit `0`.                                                                   |
| `lint`      | Sin diagnósticos, exit `0`.                                                             |
| `prettier`  | Sin salida (`--log-level warn`), exit `0`.                                              |
| `test`      | Todos los tests en verde en ambos proyectos: unitario (jsdom) y `storybook` (Chromium). |
| `build`     | `dist/` generado. Los warnings de tamaño de chunk no bloquean.                          |

Adicionalmente, conviene confirmar que Vite y el plugin de React tienen una
única instancia ([ADR 0001 §7](./adr/0001-stack-versions.md)):

```bash
pnpm why vite @vitejs/plugin-react
```

---

## 3. Ejecutar el proyecto

### 3.1 Storybook: entorno principal de desarrollo

```bash
pnpm storybook                     # http://localhost:6006
pnpm storybook --host localhost    # recomendado en redes no confiables
```

Storybook consume `vite.config.ts`, así que el alias `@/`, el React Compiler y
la configuración SCSS se comportan igual que en el build. Desde la UI tienes
disponible:

- **Docs:** página autogenerada por cada componente con `tags: ['autodocs']`.
- **Accessibility:** violaciones de axe por story. Hoy están en modo `todo`, así
  que no fallan los tests.
- **Tests por story:** botón de ejecución en el sidebar (`addon-vitest`), que
  usa el mismo runner que `pnpm test`.
- **MCP:** endpoint servido por el dev server (`addon-mcp`) para herramientas de
  IA. Por defecto escucha en todas las interfaces; de ahí la recomendación de
  `--host localhost`.

### 3.2 Playground de Vite

```bash
pnpm dev                           # http://localhost:5173
```

Monta `src/App.tsx` a través de `index.html` y `src/main.tsx`. Sirve para probar
integraciones fuera de Storybook y **no forma parte de la API pública**. Su
contenido actual es el scaffolding de Vite.

### 3.3 Tests

Hay dos proyectos de Vitest definidos en `vite.config.ts`:

| Proyecto     | Entorno                        | Descubre                        | Úsalo para                                                  |
| ------------ | ------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| (sin nombre) | jsdom, `globals: true`         | `*.test.ts(x)`                  | Hooks, utils, contratos de props y casos límite de datos.   |
| `storybook`  | Chromium headless (Playwright) | Stories de `.storybook/main.ts` | Render, interacción con `play`, foco, CSS computado y a11y. |

| Comando                                         | Efecto                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm test`                                     | Ejecución única de ambos proyectos (igual que CI).                                                |
| `pnpm exec vitest`                              | Watch mode de ambos proyectos.                                                                    |
| `pnpm exec vitest run --project=storybook`      | Solo story tests.                                                                                 |
| `pnpm exec vitest run src/ui/base/<Componente>` | Filtra por ruta.                                                                                  |
| `pnpm exec vitest run --coverage`               | Cobertura V8 en consola y en `coverage/lcov.info`.                                                |
| `pnpm exec vitest list`                         | Lista los tests descubiertos y su proyecto. Es el primer diagnóstico ante un test que "no corre". |

> El proyecto unitario no tiene `name`, así que hoy no se puede ejecutar de
> forma aislada con `--project` ([ADR 0008 §8](./adr/0008-vitest.md)).

### 3.4 Builds

```bash
pnpm build             # tsc -b && vite build → dist/
pnpm preview           # sirve dist/
pnpm build-storybook   # Storybook estático → storybook-static/
```

`dist/`, `storybook-static/` y `coverage/` están ignorados por Git, Prettier y
Oxlint.

---

## 4. Configuración del editor

El repositorio no versiona configuración de editor (`.vscode/` está ignorado).
Para VS Code, la configuración mínima recomendada es:

| Extensión | ID                       | Motivo                                           |
| --------- | ------------------------ | ------------------------------------------------ |
| Prettier  | `esbenp.prettier-vscode` | Formato con `.prettierrc.json` al guardar.       |
| Oxc       | `oxc.oxc-vscode`         | Diagnósticos de Oxlint inline.                   |
| Vitest    | `vitest.explorer`        | Ejecución y depuración de tests desde el editor. |

`settings.json` de usuario o de workspace local:

```jsonc
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "typescript.tsdk": "node_modules/typescript/lib",
}
```

- **Versión de TypeScript:** usa la del workspace
  (`TypeScript: Select TypeScript Version` → _Use Workspace Version_). El
  proyecto fija `typescript ~6.0` y la versión embebida del editor puede
  diferir.
- **Markdown y MDX:** Prettier los reformatea con `proseWrap: always` a 80
  columnas. No ajustes el ancho de línea a mano; ejecuta `pnpm prettier:fix`.

---

## 5. Primer aporte: flujo completo

Ejemplo: ticket `LDS-54`, variantes del componente `Button`.

### 5.1 Crear la rama desde `main` actualizado

```bash
git switch main
git pull --ff-only
git switch -c feature/LDS-54-boton-variantes
```

Patrón: `<tipo>/LDS-<ticket>[-<descripción-kebab>]`. Si tienes dudas sobre el
tipo, sobre todo entre `bugfix` y `hotfix`, consulta
[CONTRIBUTING §2.2](./CONTRIBUTING.md#22-tipos-de-rama).

### 5.2 Implementar siguiendo las convenciones

Checklist para un componente nuevo:

- [ ] Carpeta en PascalCase en la capa correcta: `src/ui/base/Button/`
      ([ADR 0004](./adr/0004-project-structure.md)).
- [ ] `Button.tsx` con JSDoc propio, que autodocs publica como descripción.
- [ ] `Button.scss` con BEM y prefijo `lds-` (`.lds-button`,
      `.lds-button--primary`).
- [ ] Valores de diseño tomados de tokens o de la fuente de diseño oficial.
      Ningún valor inventado.
- [ ] `Button.stories.ts` en CSF 3 con `satisfies Meta<typeof Button>`,
      `title: 'Base/Button'`, `tags: ['autodocs']` y callbacks como `fn()`. Usa
      `.stories.tsx` solo si la story contiene JSX
      ([ADR 0007 §2.6](./adr/0007-storybook.md)).
- [ ] Interacciones con `play` en la story, y lógica sin layout en
      `Button.test.tsx` con queries por rol y `userEvent`
      ([ADR 0008 §2.8](./adr/0008-vitest.md)).
- [ ] `index.ts` del componente y re-export en `src/ui/index.ts` si forma parte
      de la API pública.

### 5.3 Commit inicial

```bash
git add src/ui/base/Button
git commit -m "LDS-54: Creación de variantes del botón"
```

El primer commit **debe** empezar con `LDS-<ticket>: `
([CONTRIBUTING §6](./CONTRIBUTING.md#6-mensaje-del-commit-inicial)). Así Jira
asocia el commit al ticket desde el primer push. Si el formato es incorrecto y
la rama aún no se publicó, corrígelo con `git commit --amend`.

### 5.4 Verificación local

```bash
pnpm lint:fix && pnpm prettier:fix     # correcciones automáticas
pnpm typecheck && pnpm lint && pnpm prettier && pnpm test && pnpm build
```

Validación de metadatos antes de publicar, con los mismos patrones que CI:

```bash
git branch --show-current \
  | grep -Eq '^((feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}(-[a-z0-9]+)*|dependabot/.+)$' \
  && echo "branch-name OK" || echo "branch-name FAIL"

echo 'feature/LDS-54: Crear variantes del botón' \
  | grep -Eq '^(feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}: .{5,}$' \
  && echo "pr-title OK" || echo "pr-title FAIL"
```

### 5.5 Publicar y abrir el PR

```bash
git push -u origin feature/LDS-54-boton-variantes

gh pr create --base main --title "feature/LDS-54: Crear variantes del botón"
```

Al completar la plantilla:

- **Título:** `tipo/LDS-N: descripción en imperativo` (mínimo 5 caracteres tras
  `: `), el mismo formato que el encabezado de la plantilla. Lo valida el check
  `pr-title`.
- **Secciones:** no se elimina, renombra ni reordena ninguna. Las que no aplican
  llevan `N/A` y una justificación breve. `Summary`, `Jira URL` y
  `Type of change` no admiten `N/A`
  ([CONTRIBUTING §5](./CONTRIBUTING.md#5-plantilla-de-pull-request)).
- **`Jira URL`:** la completa el workflow `jira-url` a partir del nombre de la
  rama.
- **`Evidence`:** es obligatoria si hay impacto visual. Incluye capturas del
  componente en Storybook, con el antes y el después cuando aplique.
- **`Checks`:** marca cada ítem solo después de ejecutarlo en local
  ([§5.4](#54-verificación-local)).

Para una rama `poc/`, abre el PR en draft con la etiqueta `do not merge`:

```bash
gh pr create --draft --base main --label "do not merge" --title "poc/LDS-880: Explorar virtualización de tabla"
```

### 5.6 Checks, revisión y merge

```bash
gh pr checks --watch
```

Checks requeridos: `typecheck`, `lint`, `prettier`, `test`, `build`,
`branch-name` y `pr-title`. Cuando están en verde, un code owner revisa el PR.
Tras el merge se elimina la rama y se sincroniza el `main` local:

```bash
git switch main && git pull --ff-only && git branch -d feature/LDS-54-boton-variantes
```

---

## 6. Solución de problemas

| Síntoma                                                                    | Causa probable                                                                                    | Solución                                                                                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found`                                                  | Corepack no está habilitado para la versión de Node activa.                                       | `nvm use && corepack enable`.                                                                                                                                           |
| `pnpm -v` no imprime `12.4.1`                                              | Hay un pnpm global que tiene prioridad en el `PATH`.                                              | Desinstala el pnpm global (`npm rm -g pnpm`) y vuelve a ejecutar `corepack enable`.                                                                                     |
| `ERR_PNPM_OUTDATED_LOCKFILE` con `--frozen-lockfile`                       | `package.json` cambió sin actualizar el lockfile.                                                 | Si tu rama cambia dependencias, ejecuta `pnpm install` y commitea el lockfile en el mismo PR. Si no, descarta los cambios de `package.json`.                            |
| `pnpm test` falla con `Executable doesn't exist` o `browserType.launch`    | Chromium no está instalado o `playwright` cambió de versión.                                      | `pnpm exec playwright install chromium`.                                                                                                                                |
| Chromium no arranca en Linux (librerías compartidas faltantes)             | Faltan dependencias de sistema.                                                                   | `pnpm exec playwright install --with-deps chromium`.                                                                                                                    |
| `Invalid hook call` o `Duplicate __self prop found`                        | Resolución duplicada de Vite o de `@vitejs/plugin-react`.                                         | `pnpm why vite @vitejs/plugin-react` y alinear versiones ([ADR 0001 §7](./adr/0001-stack-versions.md)).                                                                 |
| Warning de `__dirname` con `configLoader: 'native'` al cargar la config    | Conocido; se emite una vez por proyecto de Vitest.                                                | No bloquea. Pendiente en [ADR 0007 §8](./adr/0007-storybook.md).                                                                                                        |
| Warning de chunks > 500 kB en `build-storybook`                            | Esperable en Storybook estático (`iframe`, `axe`).                                                | No afecta al bundle de la librería.                                                                                                                                     |
| Un test no aparece en la ejecución                                         | No coincide con el glob de ningún proyecto.                                                       | `pnpm exec vitest list`.                                                                                                                                                |
| `pnpm prettier` pasa en local y falla en CI                                | La caché local (`--cache`) enmascara el resultado.                                                | `pnpm exec prettier . --check` (sin caché).                                                                                                                             |
| CI falla y en local no se reproduce                                        | En orden de probabilidad: lockfile, versión de Node, caché de Prettier, dependencias de Chromium. | Revisa cada una ([ADR 0009 §3](./adr/0009-continuous-integration.md)).                                                                                                  |
| El check `branch-name` falla                                               | El nombre de la rama no cumple el patrón.                                                         | `git branch -m <nuevo>`, `git push origin -u <nuevo>` y `git push origin --delete <anterior>`. Cierra el PR y abre uno nuevo: GitHub no permite cambiar la rama origen. |
| El check `pr-title` falla                                                  | El título no cumple `tipo/LDS-N: descripción`.                                                    | Edita el título. El evento `edited` re-ejecuta la validación sin volver a correr `ci.yml`.                                                                              |
| Un check requerido queda en _Expected — Waiting for status to be reported_ | Se renombró un job o una entrada de la matriz sin actualizar la protección de `main`.             | Actualiza los checks requeridos del ruleset ([ADR 0009 §2.7](./adr/0009-continuous-integration.md)).                                                                    |

---

## 7. Lecturas recomendadas

Orden sugerido para completar el onboarding:

1. [CONTRIBUTING.md](./CONTRIBUTING.md): convenciones obligatorias.
2. [src/README.md](../src/README.md) y
   [ADR 0004](./adr/0004-project-structure.md): dónde va cada cosa.
3. [ADR 0007](./adr/0007-storybook.md) y [ADR 0008](./adr/0008-vitest.md): cómo
   se documenta y se prueba un componente.
4. [ADR 0006](./adr/0006-oxlint.md) y [ADR 0005](./adr/0005-prettier.md): reglas
   de lint y formato.
5. [ADR 0009](./adr/0009-continuous-integration.md): qué valida CI y cómo
   reproducirlo.
6. [ADR 0001](./adr/0001-stack-versions.md) y
   [ADR 0003](./adr/0003-security-baseline.md): por qué las versiones están
   fijadas y cómo se actualizan.
7. [ADR 0002](./adr/0002-github-org.md): contexto organizativo y limitaciones
   del plan.
