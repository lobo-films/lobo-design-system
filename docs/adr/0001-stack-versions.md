# ADR 0001 — Versiones del stack de build, testing y linting

| Campo               | Valor                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| Estado              | Aceptado                                                                         |
| Fecha               | 2026-09-11                                                                       |
| Ámbito              | Toolchain de frontend (build, component testing, linting)                        |
| Supersede a         | —                                                                                |
| Revisión programada | Al cerrarse `storybookjs/storybook#35752` y `#36082` (ver _Criterios de salida_) |

---

## 1. Contexto

El proyecto arranca con el toolchain de VoidZero (Vite 8 sobre Rolldown, Oxc
para transform y lint) y Storybook como entorno de desarrollo y testing de
componentes. Todas las piezas son compatibles entre sí **excepto un par**:
`@storybook/addon-vitest` todavía no absorbe dos breaking changes de Vitest 5.

Este documento fija las versiones, explica por qué `vitest` se queda
deliberadamente en la línea 4.1 pese a que 5.0 ya es estable, y define bajo qué
condición se levanta esa restricción.

> **Nota de vigencia:** la información se verificó el 2026-09-11. Los dos issues
> que motivan la decisión principal estaban abiertos en esa fecha. Antes de
> asumir que este ADR sigue vigente, revisa su estado.

---

## 2. Versiones fijadas

```json
{
  "vite": "~8.3.0",
  "storybook": "~10.6.0",
  "vitest": "~4.1.11",
  "@vitejs/plugin-react": "~6.1.1",
  "oxlint": "~1.82.0"
}
```

| Paquete                | Rango     | Razón del rango                                                                                                                                                                                             |
| ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite`                 | `8.3.x`   | 8.3 es la línea que recibe parches regulares. 8.2 y 7.3 solo reciben fixes importantes y de seguridad. Se fija la minor porque un salto de minor en Vite implica cambios en el comportamiento de Rolldown.  |
| `storybook`            | `10.6.x`  | Última minor estable. El soporte para Vite 8 llegó en 10.3 (con backport a 10.2.19), así que 10.6 lo incluye holgadamente. Se deja abierto el patch para recibir el fix de Vitest 5 sin tocar este archivo. |
| `vitest`               | `~4.1.11` | **Ver sección 3.** Piso de seguridad `4.1.8`: es la versión parcheada del advisory de Browser Mode (junto con 3.2.6 y 5.0.0-beta.4). Todo `@vitest/*` directo comparte el mismo rango.                      |
| `@vitejs/plugin-react` | `~6.1.1`  | Piso `6.1.0`: primera versión con soporte nativo de React Compiler vía Oxc para Vite 8. Ver sección 5.                                                                                                      |
| `oxlint`               | `~1.82.0` | Piso `1.82.0`: incluye las reglas derivadas de los passes de validación de React Compiler, promovidas a la categoría `correctness`.                                                                         |

Todos los rangos usan `~` (solo parches dentro del minor), conforme a la
política de ADR 0003. La columna _Razón_ justifica el minor elegido; el piso
indica la versión mínima que no debe perderse al cambiar de minor.

### Requisitos de entorno

- **Node.js ≥ 20.19 o ≥ 22.12** (requisito de Vite 8; idéntico al de Vite 7).
  Estos rangos garantizan `require(esm)` sin flag, lo que permite distribuir
  Vite como ESM puro.
- Se recomienda fijar **Node 22.12+** en `.nvmrc` y en CI aunque hoy no sea
  obligatorio: es el piso que exigirá Vitest 5 cuando se haga la migración, y
  evita tener que coordinar dos cambios a la vez.

---

## 3. Decisión principal: Vitest 4.1, no Vitest 5

Vitest 5.0 salió el 2026-09-03 y es estable. Aun así el proyecto arranca en
Vitest 4.1 (`~4.1.11`).

### 3.1 Motivo

`@storybook/addon-vitest` en Storybook 10.6 se construye contra Vitest 4 — esa
misma release bumpea Vitest a 4.1.6 por CVE-2026-47428. Hay dos breaking changes
de Vitest 5 que el addon no maneja todavía, ambos con severidad S2 en el
repositorio de Storybook:

#### Issue #36082 — herencia de configuración entre proyectos

En Vitest 5 los proyectos inline **heredan la config raíz por defecto**,
incluyendo opciones de Vite como `plugins` y `resolve.alias`. En Vitest 4 el
default es `extends: false` y la herencia requiere declarar `extends: true` en
cada proyecto.

> **Corrección (2026-09-13).** La versión inicial de esta sección asumía que
> Storybook genera su proyecto sin `extends` y recomendaba `extends: false` como
> mitigación. Ambas premisas eran incorrectas. Se verificó contra el código
> instalado y en ejecución:
>
> - Todas las plantillas de `@storybook/addon-vitest@10.6.0`
>   (`vitest.config.4.template.ts`, `vitest.config.3.2.template.ts`,
>   `vitest.config.template.ts`) declaran **`extends: true` explícito**. Es la
>   configuración presente en `vite.config.ts`.
> - `extends: true` es **necesario** en este repositorio. Con `extends: false`,
>   una story que importa `@/…` falla con `Failed to resolve import "@/…"`: el
>   proyecto `storybook` deja de heredar `resolve.alias` y, por el mismo
>   mecanismo, `plugins` (plugin de React y React Compiler) y
>   `css.preprocessorOptions` (SCSS/tokens, LDS-31).
> - `@storybook/react-vite@10.6.0` no depende de `@vitejs/plugin-react`, así que
>   heredar `react()` de la raíz no produce una segunda instancia. Suite
>   completa (`vitest run`, ambos proyectos) en verde con Vitest 4.1.11.

**Impacto sobre este repositorio.** Como la herencia ya es explícita, el cambio
de default de Vitest 5 no altera el comportamiento del proyecto `storybook`. Los
riesgos de herencia (opciones de jsdom filtrándose al proyecto de browser) ya
existen hoy en Vitest 4 con `extends: true`, y se controlan con una regla de
configuración, no con `extends: false`:

- `environment`, `setupFiles`, `globals`, `css` e `include` de tests unitarios
  se declaran **dentro del proyecto unitario**, nunca en `test` raíz.
- `test` raíz solo contiene opciones válidas para ambos proyectos (p. ej.
  `coverage`).

**Mitigación.** No requiere cambios en el consumidor: mantener `extends: true`
explícito y la regla anterior.

#### Issue #35752 — filtro por story desde la UI

Vitest 5 cambia el patrón de nombres de `suite-name test-name` a
`suite-name > test-name`. El addon construye el `testNamePattern` con el
separador viejo en `vitest-manager.ts` para ejecutar la story seleccionada desde
el sidebar.

**No es mitigable desde el consumidor** — está en el código del addon. Y no
produce una excepción: el regex simplemente no matchea, la corrida termina con
cero tests ejecutados y el status de la story no se actualiza. Un fallo
silencioso que da la apariencia de que los tests pasaron.

### 3.2 Por qué el segundo issue es el que decide

Si solo existiera #36082, la migración sería aceptable: una línea de config y
listo. El problema es #35752. El botón "run" por story es el flujo de trabajo
principal del addon durante el desarrollo; que devuelva un falso verde sin señal
de error es un riesgo de calidad desproporcionado frente al beneficio de adoptar
Vitest 5 seis meses antes de necesitarlo.

### 3.3 Alternativas consideradas

| Alternativa                                            | Por qué se descartó                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest 5 + `extends: true` + usar solo la CLI          | Neutraliza #36082 pero deja #35752 vivo. Obliga a documentar y hacer cumplir "no uses el botón del sidebar", que es una regla que nadie va a recordar bajo presión. |
| Vitest 5 con `patch-package` sobre `vitest-manager.ts` | Deuda técnica desproporcionada para ganar mejoras de rendimiento que no son bloqueantes. El parche se rompe en cada patch de Storybook.                             |
| No usar `addon-vitest`, correr solo Vitest por CLI     | Renuncia a la integración que es la razón principal de elegir este stack.                                                                                           |
| Quedarse en Vitest 3.x                                 | Sin beneficio: 4.1 tiene soporte de Vite 8 desde el día 1 y usa el Vite instalado en el proyecto en lugar de resolver su propia copia.                              |

### 3.4 Costo aceptado

La línea `vitest@5.0` recibe los parches regulares; a `vitest@4.1` solo se le
hacen backports de **fixes importantes y de seguridad**. Es decir: esta decisión
acepta quedarse sin bugfixes menores a cambio de estabilidad de la integración.
Es sostenible por semanas o algún mes, no indefinidamente — de ahí los criterios
de salida.

También se renuncia temporalmente a las mejoras de rendimiento de Vitest 5, que
en browser mode con Chromium rondan el 16–18% según los benchmarks oficiales.
Relevante pero no crítico al arrancar un proyecto.

---

## 4. Criterios de salida (cuándo subir a Vitest 5)

Se levanta la restricción cuando se cumplan las tres condiciones:

1. `storybookjs/storybook#35752` cerrado y publicado en un release de Storybook.
2. `storybookjs/storybook#36082` cerrado y publicado. Con la configuración
   actual (`extends: true` explícito) su impacto sobre este repositorio es nulo
   (§3.1); se mantiene como criterio para no migrar sobre una integración con
   issues S2 abiertos.
3. Node 22.12+ ya fijado en `.nvmrc` y en la imagen de CI (requisito de Vitest
   5, junto con Vite ≥ 6.4.0 — este último ya se cumple).

### Plan de migración (para cuando toque)

1. Subir Node a 22.12+ como cambio aislado, con su propio PR.
2. Subir `storybook` al patch que contenga los fixes.
3. Subir `vitest` y todo el grupo `@vitest/*` a 5.x en un único PR, **separado**
   de cualquier otro cambio.
4. Mantener `extends: true` explícito en el proyecto de Storybook aunque en
   Vitest 5 sea el default: documenta que la herencia de la raíz es intencional.
   **No** cambiarlo a `extends: false`, que rompe la resolución de `@/…`, React
   Compiler y SCSS en los story tests (ver corrección en §3.1). Confirmar que
   `test` raíz no contiene opciones de jsdom.
5. Revisar el resto de breaking changes de Vitest 5 que afectan a las `play`
   functions de las stories, porque usan el `expect` de Vitest reexportado por
   `storybook/test`:
   - **Aserciones asíncronas sin `await` ahora fallan el test.** Antes Vitest
     las esperaba al final del test y solo emitía un warning, así que el test
     pasaba aunque la aserción nunca corriera en el punto donde estaba escrita.
     Cualquier `expect(promise).resolves.toBe(x)` sin `await` aparecerá como
     regresión — pero es un bug real que estaba oculto, no un falso positivo.
   - **`clearMocks` ahora es `true` por defecto:** Vitest llama
     `vi.clearAllMocks()` antes de cada test. Rompe cualquier test que dependa
     de acumular llamadas entre tests.
   - Se removieron `test.sequential` y `describe.sequential`; el reemplazo es
     `concurrent: false`.
6. Validar: `vitest run --project=storybook` en CLI **y** el botón por story
   desde el sidebar de Storybook. El segundo es el que estaba roto; no basta con
   que el primero pase.

---

## 5. React Compiler: decisión pendiente, no bloqueante

`@vitejs/plugin-react@6.1.0` habilita dos rutas mutuamente excluyentes. **Se
debe elegir una sola** para que build, dev y tests produzcan el mismo output.

| Ruta               | Configuración                                                                                                                                      | Trade-off                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Babel (estable)    | `react()` + `@rolldown/plugin-babel` con `reactCompilerPreset()`, que apunta al `babel-plugin-react-compiler` (estable en 1.x desde el 2025-10-07) | Conformidad garantizada. Babel solo corre en los archivos que matchean el filtro, pero es el cuello de botella de la pipeline.                                                                                                |
| Oxc (experimental) | `react({ compiler: true })` + `oxc-transform-react`                                                                                                | Más de 10x más rápido que Babel según el benchmark de Oxc: archivos de ~100 ms bajan a ~10 ms. Conforma a la release _experimental_ de `babel-plugin-react-compiler`, aunque sus defaults siguen alineados con la v1 estable. |

Consideración específica de Storybook: `builder-vite` consume el `vite.config`
del proyecto, así que el compilador también se aplica dentro de Storybook. Con
la ruta Babel eso degrada notoriamente el dev server en un design system con
muchos componentes; con la ruta Oxc el costo es marginal.

**Recomendación:** ruta Oxc, con las reglas `correctness` de `oxlint` como red
de seguridad — que es el diseño que el propio equipo de Oxc propone, y la razón
de fijar `oxlint` en la línea 1.82 (`~1.82.0`). Formalizar en un ADR aparte.

---

## 6. Consecuencias

**Positivas**

- Integración Storybook ↔ Vitest funcional desde el día 1, sin workarounds ni
  parches.
- Un solo eje de incertidumbre abierto (Vitest 5) en lugar de varios
  simultáneos.
- Piso de seguridad cubierto: `4.1.8` incluye el parche del advisory de Browser
  Mode.

**Negativas**

- Sin bugfixes menores de Vitest hasta la migración (solo backports de seguridad
  e importantes).
- Sin las mejoras de rendimiento de Vitest 5 (~16–18% en browser mode).
- Se acumula deuda de migración: cuanto más se tarde, más breaking changes habrá
  que absorber de golpe.

**Neutras**

- El resto del stack no se ve afectado: Vite 8.3, Storybook 10.6, `plugin-react`
  6.1 y `oxlint` 1.82 son compatibles entre sí sin condiciones.

---

## 7. Verificaciones recomendadas al instalar

```bash
# 1. Instancia única de Vite y del plugin de React.
#    Una resolución duplicada de @vitejs/plugin-react produce
#    "Invalid hook call" o "Duplicate __self prop found".
pnpm why vite @vitejs/plugin-react

# 2. Que el piso de seguridad se haya resuelto correctamente.
pnpm why vitest @vitest/browser

# 3. Suite completa por CLI y luego el botón por story en el sidebar.
pnpm exec vitest run --project=storybook
```

### Migración de config heredada a Vite 8

Si se importa configuración de un proyecto en Vite 7 o anterior:

- `build.rollupOptions` → `build.rolldownOptions`
- `worker.rollupOptions` → `worker.rolldownOptions`
- `optimizeDeps.esbuildOptions` → `optimizeDeps.rolldownOptions` (deprecado;
  Vite lo convierte automáticamente por ahora)
- Los extglobs todavía no están soportados
- Soporte parcial de los namespaces legacy de TypeScript
- El interop de CJS se endureció; existe `legacy.inconsistentCjsInterop: true`
  como escape temporal

---

## 8. Referencias

- Vite 8 — anuncio y requisitos de Node:
  <https://vite.dev/blog/announcing-vite8>
- Vite — política de versiones soportadas: <https://vite.dev/releases>
- Vite — guía de migración desde v7: <https://vite.dev/guide/migration>
- Vitest 5 — anuncio y breaking changes: <https://vitest.dev/blog/vitest-5>
- Vitest — guía de migración: <https://vitest.dev/guide/migration/>
- Storybook #35752 — `testNamePattern` con Vitest 5:
  <https://github.com/storybookjs/storybook/issues/35752>
- Storybook #36082 — `projects[].extends` con Vitest 5:
  <https://github.com/storybookjs/storybook/issues/36082>
- Oxc — soporte de React Compiler en Oxlint y Oxc Transform:
  <https://oxc.rs/blog/2026-08-18-react-compiler-support.html>
- React Compiler 1.0: <https://react.dev/blog/2025/10/07/react-compiler-1>
