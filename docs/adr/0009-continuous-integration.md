# ADR 0009 — Integración continua con GitHub Actions

| Campo               | Valor                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Estado              | Aceptado — implementado, con pendientes abiertos (ver §7)                                                                                 |
| Fecha               | 2026-09-14                                                                                                                                |
| Ámbito              | `.github/workflows/*.yml`, interacción con `.github/dependabot.yml`, plantilla de PR, checks requeridos y protección de `main`            |
| Supersede a         | —                                                                                                                                         |
| Relacionada con     | 0001 (versiones), 0002 (org Free), 0003 (baseline de seguridad), 0005 (Prettier), 0006 (Oxlint), 0007 (Storybook), 0008 (Vitest)          |
| Revisión programada | Cambio del modelo de branching (CONTRIBUTING §3.2), consumo de Actions > 80 % de la cuota (ADR 0002 §8) o una _Condición de invalidación_ |

---

## 1. Contexto

ADR 0005–0008 definen las herramientas de verificación (Prettier, Oxlint,
TypeScript, Vitest con proyectos `jsdom` y `storybook`) y dejan como pendiente
explícito la ausencia de un workflow que las ejecute (ADR 0006 §7, ADR 0007 §8,
ADR 0008 §8). `docs/CONTRIBUTING.md` §7 establece que la nomenclatura de ramas y
la plantilla de PR se aplican en CI como checks **obligatorios**. Este ADR
documenta cómo se materializa eso.

Restricciones que condicionan el diseño:

- **Repositorio privado en una organización Free** (ADR 0002, ADR 0003). Los
  minutos de Actions están acotados (~2,000 min/mes) y son el primer recurso que
  se agota. Cada job se factura redondeando hacia arriba al minuto.
- **Sin secrets en CI.** Ningún workflow necesita credenciales externas; esto
  mantiene la paridad entre PRs humanos y PRs de Dependabot, que no heredan
  secrets del repositorio (ADR 0003, _Nota operativa sobre CI_).
- **Un solo mantenedor** (ADR 0002 §7). El control de calidad no puede depender
  de revisión cruzada: los checks automáticos son la única barrera verificable.
- **Story tests en browser mode** (ADR 0007 §2.5): `pnpm test` necesita Chromium
  instalado en el runner.

## 2. Decisión

Se adopta **GitHub Actions con runners hospedados `ubuntu-latest`**, disparado
exclusivamente por `pull_request` contra `main`, repartido en cuatro workflows
con responsabilidades disjuntas:

```
pull_request → main
│
├── ci.yml ─────────── verify (matriz, en paralelo, fail-fast: false)
│                      ├── typecheck   pnpm run typecheck   (tsc -b)
│                      ├── lint        pnpm run lint        (oxlint)
│                      ├── prettier    pnpm run prettier    (prettier --check)
│                      └── test        pnpm run test        (vitest run, jsdom + Chromium)
│                              │
│                              ▼ needs: verify
│                      build          pnpm run build       (tsc -b && vite build)
│
├── branch-name.yml ── branch-name     regex sobre github.head_ref
├── pr-title.yml ───── pr-title        regex sobre pull_request.title
└── jira-url.yml ───── jira-url        reescribe la sección "## Jira URL" del body
```

Principios aplicados:

1. **Una responsabilidad por workflow.** Las validaciones de metadatos (rama,
   título, body) no instalan dependencias ni comparten ciclo de vida con la
   verificación de código. Fallan en segundos, se re-ejecutan con `edited` sin
   gastar minutos de build, y un fallo de convención no oculta el estado del
   código.
2. **Paridad local–CI.** CI invoca los scripts de `package.json`, no comandos
   inline. Lo que pasa en CI es exactamente `pnpm run <script>` (§3).
3. **Toolchain declarada en el repositorio.** Node sale de `.nvmrc` y pnpm del
   campo `packageManager`. No hay versiones duplicadas en YAML.
4. **Mínimo privilegio.** `permissions` explícito a nivel de workflow en los
   cuatro archivos; ninguno usa `pull_request_target`.

### 2.1 Inventario

| Workflow          | Evento `pull_request` (types)                 | `permissions`          | Check(s) publicados                              | Instala deps |
| ----------------- | --------------------------------------------- | ---------------------- | ------------------------------------------------ | ------------ |
| `ci.yml`          | default: `opened`, `synchronize`, `reopened`  | `contents: read`       | `typecheck`, `lint`, `prettier`, `test`, `build` | Sí           |
| `branch-name.yml` | `opened`, `edited`, `synchronize`, `reopened` | `contents: read`       | `branch-name`                                    | No           |
| `pr-title.yml`    | `opened`, `edited`, `synchronize`, `reopened` | `contents: read`       | `pr-title`                                       | No           |
| `jira-url.yml`    | `opened`, `edited`, `synchronize`, `reopened` | `pull-requests: write` | `jira-url`                                       | No           |

Los cuatro filtran `branches: [main]` (rama **base** del PR).

### 2.2 `ci.yml` — verificación y build

#### Disparo y concurrencia

```yaml
on:
  pull_request:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- No se declara `types`, así que aplica el default (`opened`, `synchronize`,
  `reopened`). Editar título o descripción **no** re-ejecuta la verificación de
  código.
- En eventos `pull_request`, `github.ref` es `refs/pull/<N>/merge`: el grupo es
  por PR. Un push nuevo cancela la ejecución en curso del mismo PR, lo que evita
  pagar minutos por commits ya obsoletos. PRs distintos no se cancelan entre sí.
- El checkout por defecto de `pull_request` es el **merge commit sintético** de
  la rama sobre `main`, no el HEAD de la rama. CI verifica el resultado del
  merge en el momento del último `synchronize`, no el estado futuro de `main`
  (ver §7, _Verificación post-merge_).

#### Job `verify`: matriz de checks

```yaml
strategy:
  fail-fast: false
  matrix:
    check: [typecheck, lint, prettier, test]
name: ${{ matrix.check }}
```

- **Matriz sobre el nombre del script**, no sobre versiones de runtime. Es un
  mecanismo de paralelización, no de compatibilidad: el design system se
  verifica contra una única versión de Node (`.nvmrc`).
- `fail-fast: false` es deliberado: un error de formato no debe cancelar
  `typecheck` o `test`. El autor recibe todos los diagnósticos en una sola
  iteración, que es lo que minimiza ciclos push → CI.
- `name: ${{ matrix.check }}` hace que cada entrada publique un check con nombre
  plano (`lint`, no `verify (lint)`). Esos nombres son los que se registran como
  _required status checks_ (§2.7).
- Coste: cada entrada repite checkout, setup e install. Se acepta a cambio de
  paralelismo y aislamiento del resultado por check.

#### Resolución de toolchain y caché

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc
    cache: pnpm
- run: pnpm install --frozen-lockfile
```

- **El orden importa.** `setup-node` con `cache: pnpm` ejecuta `pnpm store path`
  para calcular el directorio a cachear; si pnpm no está en `PATH` el step
  falla. Por eso `pnpm/action-setup` va antes.
- `pnpm/action-setup` sin `version` lee `packageManager: "pnpm@12.4.1"` de
  `package.json`. Actualizar pnpm es un cambio de una línea en el manifiesto,
  aplicable igual en local (Corepack) y en CI.
- `node-version-file: .nvmrc` resuelve `24` a la última 24.x disponible en el
  runner. Satisface el piso de Node 22.12+ de ADR 0001 §2.
- `cache: pnpm` persiste el **store** de pnpm, con clave derivada del hash de
  `pnpm-lock.yaml`. No cachea `node_modules`: `pnpm install` sigue ejecutándose,
  pero resuelve desde el store local (hardlinks) sin descargar del registry. Las
  cachés de GitHub están aisladas por rama con fallback a la rama base, así que
  el primer run de un PR reutiliza la caché de `main` si existe.
- `--frozen-lockfile` falla si `package.json` y `pnpm-lock.yaml` divergen. Es la
  garantía de que CI instala exactamente el grafo revisado en el PR; un lockfile
  desactualizado se detecta aquí y no en producción.
- Los _lifecycle scripts_ de dependencias quedan restringidos por
  `pnpm-workspace.yaml` (`allowBuilds`): solo `esbuild` ejecuta su postinstall.
  Es una mitigación directa del vector de supply chain en CI descrito en ADR
  0003 (_Riesgo principal_).

#### Chromium para el proyecto `storybook`

```yaml
- name: Install Playwright Chromium
  if: matrix.check == 'test'
  run: pnpm exec playwright install --with-deps chromium
```

- Condicionado a `test`: las otras tres entradas no pagan la descarga.
- `pnpm exec` usa el `playwright` del lockfile (`~1.63.0`), por lo que la
  revisión de Chromium descargada es la que espera `@vitest/browser-playwright`.
  Esa correspondencia es la razón de que `playwright` esté fijado a parches en
  ADR 0003 y `dependabot.yml`.
- `--with-deps` instala además las librerías del sistema vía `apt`. Es el step
  más lento del pipeline y **no está cacheado** (§7).
- `pnpm run test` ejecuta `vitest run` sobre **ambos** proyectos (jsdom y
  `storybook`) en el mismo job. Cobertura no se recolecta en CI.

#### Job `build`

```yaml
build:
  needs: verify
```

- Solo corre si las cuatro entradas de la matriz terminan en `success`. Evita
  gastar minutos de build sobre código que ya se sabe inválido.
- Ejecuta `pnpm run build` = `tsc -b && vite build`. Detecta errores que los
  checks anteriores no cubren: resolución de imports en Rolldown, SCSS,
  transformaciones de React Compiler y assets.
- `tsc -b` se ejecuta dos veces por PR (en `typecheck` y en `build`). Se
  mantiene por paridad con el script local; el coste es acotado (§7).
- **Semántica de _skipped_.** Si `verify` falla, `build` queda `skipped`, y
  GitHub trata un check `skipped` como satisfecho a efectos de branch
  protection. `build` **nunca** debe ser el único check requerido: los cuatro
  checks de la matriz deben estarlo también.

### 2.3 `branch-name.yml`

```bash
^((feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}(-[a-z0-9]+)*|dependabot/.+)$
```

- Implementa CONTRIBUTING §2.1 sobre `github.head_ref`, con la excepción
  `dependabot/.+` de CONTRIBUTING §3.3.
- La rama se pasa por `env` (`BRANCH`) y no interpolada en `run:`. Un nombre de
  rama es input controlado por el autor del PR; interpolar `${{ }}` directamente
  en shell es un vector de inyección de comandos.
- `grep -Eq` usa ERE POSIX: sin lookarounds ni `\d`. El patrón está escrito
  dentro de ese subconjunto, así que es portable a cualquier hook local.
- Falla con `::error::`, que GitHub renderiza como anotación en el resumen del
  run.
- `edited` y `synchronize` son redundantes para este check (la rama origen de un
  PR no puede cambiar), pero se mantienen alineados con `pr-title.yml`; el coste
  es un minuto facturado por evento.

### 2.4 `pr-title.yml`

```bash
^(feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}: .{5,}$
```

- Formato: `<tipo>/LDS-<ticket>: <descripción ≥ 5 caracteres>`. Mismo alfabeto
  de tipos y mismas reglas de ticket que la rama (sin ceros a la izquierda, 1–4
  dígitos).
- Título por `env` (`TITLE`), por el mismo motivo de inyección que §2.3; el
  título es texto libre y es el input más peligroso de los tres.
- `edited` es necesario: corregir el título re-ejecuta el check sin push.
- **No hay validación cruzada rama ↔ título.** Ambos checks son independientes:
  `poc/LDS-26` con título `docs/LDS-26: …` pasa los dos. Ver §7.
- **No exime a Dependabot.** Ver §2.6.

### 2.5 `jira-url.yml`

Completa la sección `## Jira URL` de la plantilla
(`.github/pull_request_template.md`) con
`https://hipstha.atlassian.net/browse/LDS-XXXX`.

Algoritmo (`actions/github-script@v7`):

1. Extrae la clave con `/\bLDS-[1-9][0-9]{0,3}\b/` sobre
   `` `${head.ref} ${title}` ``. La rama tiene prioridad por posición; el título
   es fallback. Los `\b` impiden matches parciales (`LDS-12345` no produce
   `LDS-1234`).
2. Sin clave → `core.info` y sale **en éxito**. Es informativo, no una
   validación: la validación de formato es responsabilidad de §2.3 y §2.4.
3. Reemplaza el contenido entre `## Jira URL` y el siguiente `\n## ` (o fin de
   body). Si la sección no existe, la antepone.
4. **Idempotencia:** si el body resultante es idéntico, no llama a la API. Los
   eventos `edited`/`synchronize` posteriores no generan escrituras.
5. Actualiza con `pulls.update` usando `GITHUB_TOKEN`.

Propiedades relevantes:

- **Sin bucle de eventos.** Las escrituras hechas con `GITHUB_TOKEN` no disparan
  nuevos workflow runs, así que el `edited` que produce la propia actualización
  no re-ejecuta el workflow.
- **Condición de carrera.** El body se lee del payload del evento, no de la API.
  Si el autor edita la descripción entre el disparo y `pulls.update`, esa
  edición se sobrescribe con el snapshot del payload. La ventana es de segundos
  y, en la práctica, solo se abre cuando el primer `opened` coincide con una
  edición inmediata.
- `permissions: pull-requests: write` sin `contents`: el token no puede leer ni
  escribir código.
- La URL base está en `env` del step, no en una variable de repositorio. Cambiar
  de instancia de Jira requiere un PR.

Este workflow es independiente de la integración _GitHub for Jira_ (commit
`65a9c8d`), que asocia ramas, commits y PRs al ticket a partir de la clave en su
nombre o mensaje. El workflow solo mejora la navegación desde el PR.

### 2.6 Interacción con Dependabot

`dependabot.yml` abre PRs semanales para `npm` (pnpm) y `github-actions`, con
ramas `dependabot/...` contra `main`. Esos PRs pasan por los mismos workflows:

| Workflow          | Comportamiento sobre un PR de Dependabot                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`          | Corre completo. No requiere secrets, así que no hay divergencia respecto a PRs humanos. Es la barrera real contra parches que rompen tipos, lint o story tests.                                                         |
| `branch-name.yml` | Pasa por la excepción `dependabot/.+`.                                                                                                                                                                                  |
| `pr-title.yml`    | **Falla.** Los títulos de Dependabot (`Bump vite from 8.3.0 to 8.3.1`, `Bump the vitest group with 3 updates`) no cumplen el patrón. Si `pr-title` es requerido, ningún PR de Dependabot es mergeable sin intervención. |
| `jira-url.yml`    | No hay clave en rama ni título → sale en éxito sin escribir. En eventos originados por Dependabot el `GITHUB_TOKEN` es de solo lectura, pero la API nunca se invoca en ese camino.                                      |

Consecuencia sobre el workaround manual (editar el título a `arch/LDS-XXXX: …`):
hace pasar `pr-title` y activa `jira-url`. Pero si después Dependabot hace
rebase, el `synchronize` lo origina el bot, el token pasa a solo lectura y
`jira-url` falla con 403 si el body necesita actualización. Además, Dependabot
puede reescribir el título al recalcular la actualización. La corrección está en
§7.

### 2.7 Checks requeridos y protección de `main`

`main` está protegida (CONTRIBUTING §7, §8.4): no admite push directo, todo
cambio entra por PR y el merge exige en verde los siguientes contextos como
_required status checks_:

```
typecheck  lint  prettier  test  build  branch-name  pr-title
```

`jira-url` no debe ser requerido: es una automatización de conveniencia y su
fallo (p. ej. un 403) no dice nada sobre la calidad del cambio.

Reglas operativas:

- **Los contextos se identifican por el `name` del job**, no por el archivo ni
  por el id del job. Renombrar un `name` (o una entrada de la matriz) deja el
  check requerido anterior en _Expected — Waiting for status to be reported_ y
  bloquea todos los PRs abiertos hasta actualizar la regla. Todo cambio de
  nombres debe ir acompañado del cambio en el ruleset en el mismo momento.
- El id del job en `branch-name.yml` es `title` (copiado de `pr-title.yml`). No
  afecta al contexto publicado (`branch-name`), pero confunde en `needs:` o en
  la API de runs; corregir si se toca el archivo.
- La protección con enforcement está activa, lo que resuelve para este
  repositorio la fila «Verificar» de branch protection en ADR 0002 §6. Para
  auditar los contextos registrados (p. ej. tras renombrar un job), con permiso
  `admin`:

```bash
gh api repos/lobo-films/lobo-design-system/rulesets
gh api repos/lobo-films/lobo-design-system/branches/main/protection \
  --jq '.required_status_checks.checks[].context'
```

### 2.8 Superficie de ataque

Complementa la sección _Pendientes de verificar_ de ADR 0003.

| Control                                     | Estado                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pull_request_target`                       | No se usa. Los workflows de PRs desde forks corren sin secrets y con token de solo lectura.                     |
| `permissions` explícito por workflow        | Sí, en los cuatro. Sobrescribe `default_workflow_permissions` del repo para estos archivos.                     |
| Inputs de usuario interpolados en shell     | No. Rama y título se pasan por `env`.                                                                           |
| Pinning de actions                          | Por tag de major (`@v4`, `@v7`), no por SHA. Dependabot (`github-actions`) actualiza los tags.                  |
| `persist-credentials` en `actions/checkout` | Default (`true`): el token queda en `.git/config` durante `pnpm install`. Impacto acotado por `contents: read`. |
| Lifecycle scripts de dependencias           | Restringidos por `allowBuilds` en `pnpm-workspace.yaml`.                                                        |
| Escaneo de secretos                         | No existe (control compensatorio pendiente en ADR 0003).                                                        |
| `timeout-minutes`                           | No declarado: aplica el default de 360 min por job.                                                             |

## 3. Reproducción local

Secuencia equivalente a `ci.yml` desde un clon limpio:

```bash
nvm use                                   # Node según .nvmrc
corepack enable                           # pnpm según packageManager
pnpm install --frozen-lockfile
pnpm exec playwright install chromium     # --with-deps solo en Linux sin libs del sistema

pnpm run typecheck && pnpm run lint && pnpm run prettier && pnpm run test && pnpm run build
```

Validación de metadatos antes de abrir el PR:

```bash
git branch --show-current \
  | grep -Eq '^((feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}(-[a-z0-9]+)*|dependabot/.+)$' \
  && echo "branch-name OK" || echo "branch-name FAIL"

echo 'feature/LDS-54: Crear variantes del botón' \
  | grep -Eq '^(feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}: .{5,}$' \
  && echo "pr-title OK" || echo "pr-title FAIL"
```

Para diagnosticar un fallo de CI que no se reproduce en local, las fuentes de
divergencia habituales son, en orden: lockfile desincronizado, versión de Node
distinta (la de CI flota dentro de 24.x), caché de Prettier local (`--cache` no
persiste en CI) y dependencias de sistema de Chromium.

## 4. Alternativas consideradas

| Alternativa                                                                              | Motivo de descarte                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un único job secuencial (`typecheck && lint && prettier && test && build`)               | Menos minutos (un install), pero el primer fallo oculta los demás y el wall time es la suma. Se prioriza feedback completo por iteración.                                           |
| Validaciones de metadatos como steps dentro de `ci.yml`                                  | Obligaría a re-ejecutar install y build ante un `edited`, o a condicionar steps por tipo de evento. Mezcla fallos de convención con fallos de código en el mismo check.             |
| Actions de terceros para título/rama (`amannn/action-semantic-pull-request` y similares) | Añaden dependencia de supply chain con acceso al token para un `grep` de una línea. La convención de LDS no es Conventional Commits, así que tampoco hay ganancia de configuración. |
| Contenedor `mcr.microsoft.com/playwright` para el job `test`                             | Elimina `playwright install --with-deps`, pero acopla la imagen a la versión de `playwright` fuera de Dependabot `npm`. Queda como optimización candidata (§7).                     |
| Self-hosted runner en el VPS                                                             | Sin coste por minuto, pero con operación propia. ADR 0002 §8 lo sitúa como último recurso ante agotamiento de cuota; no se cumple el _trigger_.                                     |
| Disparo también en `push` a ramas de trabajo                                             | Duplica ejecuciones (push + PR) sin información adicional; con `pull_request` se verifica además el merge con `main`.                                                               |

## 5. Consecuencias

**Positivas**

- Las convenciones de CONTRIBUTING §2 y la verificación de ADR 0005–0008 dejan
  de depender de disciplina individual: quedan como checks con resultado
  auditable por PR.
- Toolchain única declarada en el repo (`.nvmrc`, `packageManager`, lockfile
  congelado): no hay deriva entre YAML y manifiesto.
- Los PRs de Dependabot pasan por la misma verificación que los humanos, que es
  la condición que ADR 0003 asume para aceptar solo parches sin auto-merge.
- Permisos mínimos y ausencia de secrets reducen la superficie de un paquete
  comprometido ejecutándose en el runner.

**Negativas / asumidas**

- Coste mínimo de 8 minutos facturados por `opened`/`synchronize` (8 jobs,
  redondeo por job) y de 3 por cada `edited`. El coste real está dominado por
  los 5 `pnpm install` y la instalación de Chromium; no se ha medido todavía
  (§7).
- `ubuntu-latest` y `24` en `.nvmrc` son flotantes: un cambio de imagen del
  runner o un minor de Node puede romper CI sin cambios en el repositorio.
- Pinning por tag de major: una action comprometida o un retag afectaría a CI
  hasta detectarse.
- La verificación es sobre el merge con `main` en el último `synchronize`, no
  sobre `main` post-merge.

## 6. Estado de la implementación (2026-09-14)

Revisión estática del contenido de `main` (`b40fb3a`, incluye #15):

| Verificación                                                | Resultado                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Cuatro workflows presentes con `permissions` explícito      | ✅                                                                         |
| Uso de `pull_request_target` o inputs interpolados en shell | ✅ Ninguno                                                                 |
| Bloqueante 1 de ADR 0008 §8 (test en rojo intencional)      | ✅ Resuelto: no hay `fails intentionally` en `src/`                        |
| Bloqueante de ADR 0007/0008 (Chromium en CI)                | ✅ `playwright install --with-deps chromium` condicionado a `test`         |
| Branch protection de `main`                                 | ✅ Protegida: sin push directo, PR obligatorio y checks requeridos de §2.7 |
| Consumo de minutos por PR                                   | ⚠️ No medido                                                               |

Desviaciones abiertas respecto a documentos vigentes:

| Desviación                                                                                                                                      | Documento afectado |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| CONTRIBUTING §4 declara el merge de `poc/` bloqueado. Ningún workflow lo aplica: el contenido de `poc/LDS-26` está integrado en `main` vía #15. | CONTRIBUTING §4    |
| CONTRIBUTING §3.3 exime `renovate/*`; `branch-name.yml` solo exime `dependabot/.+`. Sin impacto mientras no se adopte Renovate.                 | CONTRIBUTING §3.3  |
| ADR 0006 §7, ADR 0007 §8 y ADR 0008 §8 afirman que no existe workflow de CI.                                                                    | 0006, 0007, 0008   |

Desviaciones resueltas en LDS-27:

| Desviación                                                                                                   | Resolución                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| La plantilla de PR encabezaba con `{type}(LDS-XXXX): …`, mientras `pr-title.yml` exige `{type}/LDS-XXXX: …`. | Encabezado cambiado a `{type}/LDS-XXXX: {descripción en imperativo}`.                                           |
| La sección _Checks_ de la plantilla listaba `npm run …` y el script inexistente `oxlint`.                    | Cambiada a `pnpm run typecheck`, `lint`, `prettier`, `test` y `build`.                                          |
| _Type of change_ de la plantilla no incluía `arch`.                                                          | `arch` añadido.                                                                                                 |
| CONTRIBUTING §3.2 dirigía `feature`/`bugfix`/`docs`/`arch` a una rama de integración inexistente.            | Se elimina la rama de integración del modelo: todo PR va contra `main`, que es lo que ya filtran los workflows. |

## 7. Pendientes y riesgos abiertos

Bloqueantes:

1. **`pr-title` rechaza todos los PRs de Dependabot** (§2.6). Eximirlos en el
   propio job, por rama y no por actor (el actor de un `edited` puede ser
   humano):

   ```yaml
   jobs:
     title:
       if: ${{ !startsWith(github.head_ref, 'dependabot/') }}
   ```

   Un job omitido por `if` publica el check como `skipped`, que satisface el
   check requerido. Aplicar la misma condición a `jira-url.yml` para eliminar el
   caso del 403.

No bloqueantes:

- **Validación cruzada rama ↔ título.** Extraer `tipo/LDS-N` de ambos y exigir
  igualdad en `pr-title.yml`. Cierra el caso `poc/LDS-26` → `docs/LDS-26`.
- **Bloqueo de `poc/`** (CONTRIBUTING §4): job que falle si
  `startsWith(github.head_ref, 'poc/')` o si el PR tiene la etiqueta
  `do not merge` (añadir `labeled`/`unlabeled` a `types`), registrado como check
  requerido.
- **Verificación post-merge.** Opciones, de menor a mayor coste: exigir _Require
  branches to be up to date before merging_ en la regla de `main`; añadir
  `push: branches: [main]` a `ci.yml`; merge queue (`merge_group`), cuya
  disponibilidad en repos privados de una org Free debe verificarse.
- **`timeout-minutes`** en todos los jobs (p. ej. 2 para metadatos, 10 para
  `verify`, 15 para `test`). Un Chromium colgado consume hasta 360 min de cuota.
- **Caché de Playwright.** `actions/cache` sobre `~/.cache/ms-playwright` con
  clave en la versión resuelta de `playwright` (ADR 0007 §8); en cache hit,
  ejecutar solo `playwright install-deps chromium`. Alternativa: contenedor
  oficial de Playwright (§4).
- **Oxlint en modo CI:** `oxlint --deny-warnings -f github` (ADR 0006 §3.2, §7)
  para que los warnings fallen el check y aparezcan como anotaciones inline.
- **Smoke test de Storybook:** añadir `build-storybook` a la matriz o como job
  dependiente de `verify` (ADR 0007 §8).
- **Evitar el doble `tsc -b`:** en el job `build`, ejecutar `vite build` en
  lugar de `pnpm run build`, dado que `typecheck` ya es precondición por
  `needs`. Contrapartida: el job deja de ser idéntico al script local.
- **Pinning por SHA** de `actions/*`, `pnpm/action-setup` y
  `actions/github-script`, con comentario de versión (`@<sha> # v4.2.2`).
  Dependabot mantiene SHAs con ese formato.
- **`persist-credentials: false`** en `actions/checkout`: ningún job hace push.
- **Escaneo de secretos en CI** (ADR 0003, _Control compensatorio_).
- **Separar `test:unit` y `test:storybook`** (ADR 0007 §8, ADR 0008 §8) y, con
  ello, instalar Chromium solo en la entrada que lo necesita.
- **Cobertura como gate** una vez definidos `coverage.include` y `thresholds`
  (ADR 0008 §8).
- **Medir consumo:** registrar minutos facturados por PR durante un mes para
  alimentar el _trigger_ 1 de ADR 0002 §8.
- **`JIRA_BASE_URL`** como variable de repositorio (`vars.JIRA_BASE_URL`) en
  lugar de literal en el workflow.
- **Renombrar el id del job** de `branch-name.yml` de `title` a `branch-name`.
- **Actualizar ADR 0006 §7, 0007 §8 y 0008 §8** para referenciar este ADR.

## 8. Condiciones de invalidación

Esta decisión debe revisarse si:

- El consumo de Actions supera el 80 % de la cuota durante dos meses (ADR 0002
  §8, _trigger_ 1): primero aplicar las optimizaciones de §7 (caché de
  Playwright, doble `tsc`, `paths-ignore` para cambios solo en `docs/`), después
  evaluar self-hosted runner o plan Team.
- El repositorio pasa a público: los minutos dejan de ser restricción, los PRs
  desde forks se vuelven un escenario real y el modelo de permisos de §2.8 debe
  re-evaluarse (en particular, cualquier propuesta de `pull_request_target`).
- Se adopta Chromatic u otro servicio que requiera secrets: rompe la paridad con
  Dependabot (ADR 0003) y exige _Dependabot secrets_ o un workflow separado.
- Se publica el paquete a un registry: aparece un workflow de release con
  `contents: write`/`id-token: write` y disparo por tag, fuera del alcance de
  este ADR.
- Se migra a monorepo (ADR 0002 §10): la matriz por script pasa a matriz por
  paquete afectado.
- Cambia el modelo de branching de CONTRIBUTING §3 (p. ej. se introduce una rama
  de integración): hay que añadir la nueva rama base a `branches:` en los cuatro
  workflows en el mismo PR, o CI deja de cubrir esos PRs.

## 9. Referencias

- GitHub Actions — sintaxis de workflows:
  <https://docs.github.com/actions/writing-workflows/workflow-syntax-for-github-actions>
- GitHub Actions — eventos `pull_request` y tipos por defecto:
  <https://docs.github.com/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#pull_request>
- GitHub Actions — `concurrency`:
  <https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs>
- GitHub Actions — `GITHUB_TOKEN` y eventos que no disparan workflows:
  <https://docs.github.com/actions/security-for-github-actions/security-guides/automatic-token-authentication>
- GitHub Actions — hardening e inyección de scripts:
  <https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions>
- GitHub — checks requeridos y jobs omitidos:
  <https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/troubleshooting-required-status-checks>
- Dependabot en GitHub Actions (token de solo lectura, sin secrets):
  <https://docs.github.com/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions>
- `actions/setup-node` — caché de gestores de paquetes:
  <https://github.com/actions/setup-node#caching-global-packages-data>
- `pnpm/action-setup`: <https://github.com/pnpm/action-setup>
- pnpm — CI: <https://pnpm.io/continuous-integration>
- Playwright — CI: <https://playwright.dev/docs/ci>
- `actions/github-script`: <https://github.com/actions/github-script>
