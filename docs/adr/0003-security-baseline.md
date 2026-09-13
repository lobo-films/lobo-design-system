# 0003 — Security baseline: gestión de dependencias vía Dependabot

- **Estado:** Aceptada
- **Fecha:** 2026-09-11
- **Supersede:** —
- **Superseded by:** —
- **Ámbito:** `.github/dependabot.yml`, `package.json`, lockfile, workflows de
  CI, ajustes de seguridad del repositorio

---

## Contexto

El repositorio depende de un conjunto de herramientas de build y tooling cuyas
versiones están acopladas entre sí (Vite ↔ `@vitejs/plugin-react`, Storybook ↔
su builder de Vite, Vitest ↔ su runtime). Las actualizaciones automáticas sin
restricciones producen dos problemas concretos:

1. **Ruptura de acoplamiento por peer dependencies.** Un bump de minor en Vite
   puede invalidar el rango de peer del plugin de React o del builder de
   Storybook. El PR pasa lint y type-check, pero falla en build o en el arranque
   de Storybook — a veces solo en CI, no en local, por diferencias de resolución
   del lockfile.
2. **Volumen de PRs.** Sin agrupación ni filtros, un proyecto con el ecosistema
   de React genera decenas de PRs semanales. El efecto práctico observado en
   equipos es que se dejan de revisar y se mergean por inercia, lo que degrada
   la señal de seguridad en lugar de mejorarla.

La decisión busca un baseline conservador: cadena de tooling estable y revisada
manualmente en ventanas planificadas, con Dependabot activo para el resto del
árbol de dependencias.

## Decisión

Se fijan las siguientes versiones de tooling. Todas siguen la misma política:
**solo parches** dentro del minor fijado; minors y majors requieren evaluación
manual.

| Paquete                      | Versión objetivo | Política     | Justificación                                                                                                                      |
| ---------------------------- | ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `vite`                       | `8.3.x`          | Solo parches | Se aceptan correcciones de bugs dentro del minor; minor/major requieren evaluación manual por el acoplamiento con plugin y builder |
| `storybook` + `@storybook/*` | `10.6.x`         | Solo parches | Los paquetes de Storybook versionan en sincronía; un bump parcial rompe la alineación del monorepo upstream                        |
| `@chromatic-com/storybook`   | `5.3.x`          | Solo parches | Addon con peer dependency de `storybook`; sus minors acompañan a los de Storybook                                                  |
| `vitest` + `@vitest/*`       | `4.1.x`          | Solo parches | Los paquetes de Vitest versionan en sincronía y Vitest advierte si difieren. Piso de seguridad `4.1.8` (ADR 0001 §2)               |
| `playwright`                 | `1.63.x`         | Solo parches | Cada minor trae una revisión nueva de Chromium: cambia el browser de los story tests y puede alterar el render (ADR 0007)          |
| `@vitejs/plugin-react`       | `6.1.x`          | Solo parches | Peer dependency directa de Vite; su minor debe coordinarse con el de Vite. Piso `6.1.0` (ADR 0001 §2)                              |
| `oxlint`                     | `1.82.x`         | Solo parches | Los minors añaden o recategorizan reglas y alteran el resultado de CI sin cambios en el código. Piso `1.82.0` (ADR 0001 §2)        |

Todo paquete **no** listado arriba queda bajo actualización automática semanal
sin restricciones.

### Implementación

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    ignore:
      - dependency-name: 'vite'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: 'storybook'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: '@storybook/*'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: '@chromatic-com/storybook'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: 'vitest'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: '@vitest/*'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: 'playwright'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: '@vitejs/plugin-react'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
      - dependency-name: 'oxlint'
        update-types:
          ['version-update:semver-major', 'version-update:semver-minor']
    groups:
      vitest:
        patterns: ['vitest', '@vitest/*']
        update-types: ['patch']
      storybook:
        patterns: ['storybook', '@storybook/*']
        update-types: ['patch']

  - package-ecosystem: github-actions
    directory: '/'
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

### Condición necesaria en el manifiesto

**Dependabot no controla qué versión se instala; solo controla qué PRs
propone.** El `ignore` no impide que un `pnpm install` sin lockfile, un
`pnpm update` o una resolución transitiva traigan una versión distinta. El pin
es efectivo solo si los rangos del `package.json` son consistentes con esta
tabla:

- `vite`: `~8.3.0` — permite parches, bloquea minor
- `storybook` y `@storybook/*`: `~10.6.0`
- `@chromatic-com/storybook`: `~5.3.1`
- `vitest` y todo `@vitest/*` directo (`@vitest/coverage-v8`,
  `@vitest/browser-playwright`): `~4.1.11`, **el mismo rango en todos**
- `playwright`: `~1.63.0`
- `@vitejs/plugin-react`: `~6.1.1`
- `oxlint`: `~1.82.0`

Ningún paquete de la tabla usa `^`, que admite minors. Tampoco versión exacta:
la reproducibilidad la garantiza el lockfile, y con `~` los parches se aplican
con `pnpm update` o con el PR de Dependabot sin editar el rango.

El lockfile committeado es la fuente de verdad para reproducibilidad. La config
de Dependabot y los rangos del manifiesto son dos mitades del mismo candado; una
sin la otra no sostiene la política.

### Agrupación de parches

Los paquetes que versionan en sincronía (`vitest` + `@vitest/*`, `storybook` +
`@storybook/*`) se agrupan con `groups` restringido a `patch`. Sin agrupación,
Dependabot abre un PR por paquete: mergear solo uno deja el grupo desalineado
(p. ej. `vitest@4.1.12` con `@vitest/browser-playwright@4.1.11`), que es el modo
de falla que la tabla intenta evitar. Los grupos se limitan a `patch`; los
minors y majors de esos paquetes ya están excluidos por los `ignore`.

## Consecuencias

### Aceptadas

- La cadena de tooling se actualiza en ventanas planificadas, no de forma
  oportunista. Requiere que alguien la agende — no ocurre sola.
- Vite y `@vitejs/plugin-react` reciben parches por separado, pero cualquier
  subida de minor en Vite tiene al plugin como primer punto de falla probable.
  Los minors de Vite y del plugin deben subirse en el mismo PR.
- Un parche de `oxlint` puede corregir falsos negativos de una regla y hacer
  fallar CI sin cambios en el código. Se acepta: el PR de Dependabot lo muestra
  antes del merge.
- `open-pull-requests-limit: 5` aplica **por ecosistema**, no en total: pueden
  coexistir hasta 10 PRs abiertos (5 npm + 5 actions).
- La sección de `github-actions` no tiene filtros y propondrá majors. Es
  intencional: las actions tienen superficie de cambio menor y el costo de
  quedarse atrás (runners deprecados, Node EOL en la action) es mayor que el de
  revisar el PR.

### Riesgo principal: remediación de CVEs fuera del minor fijado

Con el estado de plataforma confirmado (ver _Configuración de plataforma_), la
**detección** está cubierta: las alertas de Dependabot se generan para cualquier
dependencia del grafo, con independencia de las condiciones `ignore` del
`dependabot.yml`. Un CVE en cualquier paquete de la tabla aparecerá en la
pestaña Security.

El riesgo residual está en la **remediación automática**: las condiciones
`ignore` afectan a Dependabot más allá de los version updates, por lo que un CVE
cuyo fix solo exista en un minor o major posterior puede no producir PR aunque
_Dependabot security updates_ esté habilitado.

Queda pendiente verificar contra la documentación vigente de GitHub si un
`ignore` por `update-types` bloquea también los security updates. Mientras no
esté confirmado, se asume el peor caso: **detección automática, remediación
manual** para fixes fuera del minor.

**Mitigación requerida:** triage manual de las alertas correspondientes a los
paquetes de la tabla. Un CVE corregido con un parche dentro del minor llega como
PR de version update aunque el security update no se genere; la revisión manual
es necesaria cuando el fix solo se publica en un minor o major posterior. Todos
son devDependencies — no llegan al bundle de producción — lo que reduce pero no
elimina la exposición: el vector realista es compromiso de la cadena de
suministro ejecutándose en CI con acceso al runner y, según la configuración de
permisos, al `GITHUB_TOKEN`.

### Nota operativa sobre CI

Los PRs de Dependabot corren con un token de permisos restringidos y **no
heredan los secrets del repositorio**. Si algún job de CI requiere secrets,
deben declararse aparte como _Dependabot secrets_ o los PRs fallarán de forma
que parece un problema del código.

---

## Configuración de plataforma

El `dependabot.yml` es una capa sobre ajustes del repositorio que deben estar
activos para que la política tenga efecto. Estado verificado al 2026-09-11:

| Ajuste                      | Estado                          | Función en este baseline                                                                           |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Dependency graph            | Habilitado                      | Prerrequisito de todo lo demás; sin el grafo no hay alertas ni updates                             |
| Dependabot alerts           | Habilitado                      | **Detección.** Se emite por cualquier dependencia del grafo, incluidas las que están bajo `ignore` |
| Dependabot malware alerts   | Habilitado                      | Detección de paquetes retirados del registro por ser maliciosos, no de CVEs convencionales         |
| Dependabot security updates | Habilitado                      | **Remediación automática** de CVEs. Sujeto al riesgo de interacción con `ignore` descrito arriba   |
| Dependabot version updates  | Habilitado vía `dependabot.yml` | Objeto de esta decisión                                                                            |

### Visibilidad del repositorio

El repositorio es **privado**, por decisión vigente. Se contempla la posibilidad
de hacerlo público a futuro, pero no hay compromiso ni fecha; el baseline se
diseña para el estado actual.

Esa decisión determina qué funciones de seguridad están disponibles. En la
sección `Settings → Advanced Security` solo se muestran las opciones de
Dependabot: no aparecen secret scanning, push protection ni private
vulnerability reporting.

### No disponibles por licencia o visibilidad

| Función                         | Causa                                                                      | Qué la haría disponible                                  |
| ------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Secret scanning                 | Requiere el SKU _Secret Protection_ en repos privados                      | Contratar el SKU, o hacer el repo público (gratuito ahí) |
| Push protection                 | Depende de secret scanning                                                 | Igual que arriba                                         |
| Private vulnerability reporting | Es un canal para reportes de terceros externos; no aplica a repos privados | Hacer el repo público                                    |

Estas funciones **no son un pendiente de configuración**: no se resuelven con un
toggle. Secret scanning y push protection implican una decisión de compra que
escala a quien controle el presupuesto; private vulnerability reporting depende
de la visibilidad.

**Causa a confirmar.** El diagnóstico anterior es la explicación más probable
del comportamiento observado, pero no está verificado. Un permiso `write` en
lugar de `admin` produce el mismo síntoma — la sección se muestra recortada —
igual que una política de organización que oculte las funciones. Para
distinguirlo:

```bash
gh api repos/$OWNER/$REPO --jq '{visibility, private, security_and_analysis}'
```

Si `security_and_analysis` sale `null` o ausente, es permisos. Si sale el objeto
pero sin las claves `secret_scanning` y `secret_scanning_push_protection`, es
licencia, y este apartado queda confirmado.

### Control compensatorio: escaneo de secretos en CI

Sin push protection, nada impide que un secreto entre al historial. El control
sustituto es un job de CI con `gitleaks` o `trufflehog` sobre el diff del PR.

Diferencias respecto a push protection que hay que asumir de forma consciente:

- **Detecta después del push, no antes.** El secreto ya está en el historial del
  branch remoto cuando se dispara la alerta. La remediación es rotar la
  credencial, no reescribir el historial.
- **No hay validación contra el proveedor.** GitHub verifica si el token
  detectado está activo; las herramientas de CI solo hacen match de patrón, con
  más falsos positivos.
- **No hay notificación al emisor.** El programa de partners de GitHub avisa al
  proveedor cuando detecta un token suyo filtrado. Eso se pierde.

Pendiente de implementar. Mientras no exista, el repositorio no tiene ninguna
barrera contra el commit de secretos.

### Pendientes de verificar

Estos sí son configuración y están disponibles con independencia de la
visibilidad. **No deben asumirse activos:**

- Actions: `default_workflow_permissions` en `read` y _Allow GitHub Actions to
  create and approve pull requests_ desactivado (`Settings → Actions → General`,
  al final de la página, con _Save_ propio)
- Overrides de `permissions:` en archivos individuales de `.github/workflows/`,
  que sobreescriben el default del repositorio
- Uso de `pull_request_target`, que ejecuta con contexto del repo base y acceso
  a secrets
- Políticas a nivel de organización, que pueden anular ajustes del repositorio
  sin señal visual clara en la UI del repo

Este bloque es la prioridad de remediación: el vector descrito en _Riesgo
principal_ (supply chain ejecutándose en CI) se agrava de forma significativa si
el `GITHUB_TOKEN` está en `write` por defecto.

### Verificación reproducible

La UI sirve para una primera pasada, pero no expone overrides de organización ni
de workflow. Para el registro trimestral, con permiso `admin` sobre el
repositorio:

```bash
OWNER=<org>; REPO=<repo>

gh api repos/$OWNER/$REPO --jq '.security_and_analysis'
gh api repos/$OWNER/$REPO/vulnerability-alerts -i | head -1   # 204 = on, 404 = off
gh api repos/$OWNER/$REPO/private-vulnerability-reporting
gh api repos/$OWNER/$REPO/actions/permissions
gh api repos/$OWNER/$REPO/actions/permissions/workflow

# Overrides por workflow — no visibles en la UI
grep -rn "permissions:\|pull_request_target" .github/workflows/
```

Sin permiso `admin`, el objeto `security_and_analysis` se omite de la respuesta
y el resultado es indistinguible de "todo deshabilitado".

---

## Alternativas consideradas

**Renovate.** Ofrece agrupación por presets, control de schedule más fino y
auto-merge nativo por tipo de cambio. Se descarta por costo de adopción:
requiere instalar y mantener una app externa y un `renovate.json` con más
superficie de configuración. La ganancia no justifica el cambio al volumen
actual de dependencias. Se reconsidera si el repo crece a monorepo con múltiples
manifiestos.

**Agrupación general con `groups` en Dependabot.** Reduce el ruido consolidando
PRs por patrón o por `dependency-type`. Solo se adopta para los parches de los
grupos que versionan en sincronía (ver _Agrupación de parches_), donde resuelve
un problema de consistencia y no de volumen. Extenderla al resto del árbol es la
primera adición a considerar si el volumen de PRs vuelve a ser un problema.

**Sin restricciones (estado previo).** Descartado por el modo de falla descrito
en Contexto.

## Qué invalidaría esta decisión

- Confirmación de que los `ignore` bloquean los PRs de _security updates_ **y**
  aparición de un CVE explotable cuyo fix solo existe fuera del minor fijado →
  subir el minor manualmente en una ventana no planificada, o retirar el paquete
  afectado de la tabla.
- Deshabilitación de _Dependency graph_ o _Dependabot alerts_ → el baseline
  pierde la capa de detección y la política de minors fijados deja de ser
  defendible; en ese escenario hay que liberar los rangos o adoptar escaneo
  externo (`pnpm audit` en CI, Socket, Snyk).
- Migración a monorepo Nx con `package.json` por paquete → `directory: "/"` deja
  de cubrir el árbol; se requiere `directories` (plural, acepta globs) o
  entradas adicionales por paquete.
- Introducción de Dockerfiles → falta la entrada `package-ecosystem: docker`;
  las imágenes base no se actualizan con esta configuración.
- Volumen de PRs no ignorados que vuelva inviable la revisión → introducir
  `groups`.
- **Cambio de visibilidad a público** → secret scanning, push protection y
  private vulnerability reporting pasan a estar disponibles sin costo. Revisar
  la sección _No disponibles por licencia_ y decidir si el escaneo en CI se
  retira o se mantiene en paralelo. Antes de publicar el repositorio hay que
  auditar el historial completo por secretos committeados: hacerlo público
  expone todo el historial, no solo el estado actual.
- Contratación del SKU _Secret Protection_ con el repo aún privado → mismo
  efecto para secret scanning y push protection, sin cambiar la situación de
  private vulnerability reporting.

## Revisión

Cada trimestre, o al abrir una ventana de actualización de tooling. La
actualización de Vite y `@vitejs/plugin-react` debe hacerse en un solo PR, con
verificación de build de producción y arranque de Storybook antes del merge.

## Historial de revisión

| Fecha      | Cambio                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 | Versión inicial: política de pinning y configuración de `dependabot.yml`                                                                                                                                                                                                        |
| 2026-09-11 | Añadida sección _Configuración de plataforma_; confirmados dependency graph, alerts, malware alerts y security updates. Riesgo de seguridad reclasificado: detección cubierta, remediación automática pendiente de verificar                                                    |
| 2026-09-11 | Registrada visibilidad privada. Secret scanning, push protection y private vulnerability reporting reclasificados de _pendiente de verificar_ a _no disponible por licencia/visibilidad_. Añadido escaneo de secretos en CI como control compensatorio pendiente de implementar |
| 2026-09-13 | Instalación de Storybook (ADR 0007). `vitest` + `@vitest/*` pasan de congelado (`4.1.8`) a solo parches (`~4.1.11`). Añadidos `playwright` y `@chromatic-com/storybook` con política de solo parches. Añadidos `groups` de parches para Vitest y Storybook                      |
| 2026-09-13 | `@vitejs/plugin-react` (`~6.1.1`) y `oxlint` (`~1.82.0`) pasan de congelados a solo parches; Dependabot usa `update-types` para ambos. Ya no hay paquetes con `versions: [">= 0"]`. Riesgo de CVEs reformulado en función del minor fijado                                      |

## Referencias

- GitHub Docs — Configuration options for the `dependabot.yml` file
- GitHub Docs — Configuring access to private registries / Dependabot secrets
