# ADR 0010 — Arquitectura y estructura de design tokens

| Campo               | Valor                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Estado              | Aceptado — implementado, con pendientes abiertos (ver §7)                                                                      |
| Fecha               | 2026-09-20                                                                                                                     |
| Ámbito              | `src/styles/tokens/*`, `src/styles/abstracts/_breakpoints.scss`, `src/styles/base/*`, `src/styles/index.scss`, `src/ui/theme/` |
| Supersede a         | —                                                                                                                              |
| Relacionada con     | 0001 (versiones del stack), 0004 (estructura de directorios), 0005 (Prettier), 0007 (Storybook)                                |
| Revisión programada | Introducción de un segundo tema, empaquetado del sistema como librería (CONTRIBUTING §9) o una _Condición de invalidación_     |

---

## 1. Contexto

ADR 0004 fijó la separación entre `styles/tokens/` (valores puros, _single
source of truth_) y `styles/abstracts/` (lógica que opera sobre esos valores),
pero dejó sin decidir todo lo demás: en qué formato se emiten los tokens,
cuántas capas de indirección tienen, cómo se nombran, en qué orden se componen y
cómo llegan a superficies que no son CSS.

Las restricciones que condicionan el diseño son:

- **El sistema no tiene aún componentes reales.** Los tokens se definieron antes
  que la capa de UI (LDS-31 a LDS-48). Esto permite fijar el contrato primero,
  pero implica que su ergonomía no está validada contra consumo real: no hay
  ningún componente que haya ejercido la escala completa.
- **Un solo tema visual, oscuro, de marca.** Lobo Films es el único consumidor.
  El tema `Angustia` es dark-only y no existe requisito conocido de tema claro.
- **SCSS con BEM, sin CSS Modules** (ADR 0004). El aislamiento depende de
  convención, y los tokens son el mecanismo que impide que cada componente
  invente sus propios valores.
- **Storybook es el entorno de documentación y desarrollo** (ADR 0007). Su
  _manager UI_ se configura con un objeto JavaScript (`storybook/theming`) que
  se evalúa fuera del documento donde viven las custom properties.
- **El paquete se distribuirá como dependencia.** Los consumidores necesitan
  poder sobreescribir valores sin recompilar SCSS.

## 2. Decisión

### 2.1 Formato de salida: custom properties CSS, no variables SCSS

Todos los tokens de diseño se emiten como **custom properties CSS declaradas en
`:root`**. Las variables SCSS (`$variable`) quedan reservadas exclusivamente
para valores que el navegador no puede resolver en tiempo de ejecución.

La consecuencia práctica: un token es un valor vivo en el documento, no una
sustitución textual en tiempo de compilación. Se puede inspeccionar en DevTools,
sobreescribir por selector o por contenedor, y leer desde JavaScript con
`getComputedStyle`. Un consumidor del paquete puede redefinir `--accent` en su
propio `:root` sin tocar el build del design system.

El costo asumido es que el compilador no valida nada: `var(--colour-accent)`
(con la grafía equivocada) compila sin error y falla en silencio en el
navegador, resolviendo al valor de fallback o a `unset`. No hay red de seguridad
en build time; ver §7.

### 2.2 Arquitectura de dos capas

Los tokens se organizan en dos capas con responsabilidades disjuntas:

```
Capa 1 — PRIMITIVA            Capa 2 — SEMÁNTICA              Consumo
(qué valor es)                (para qué sirve)                (componentes)

--color-neutral-950  ───────▶ --bg-canvas          ───────▶  background: var(--bg-canvas)
--color-neutral-900  ───────▶ --bg-surface
--color-neutral-800  ───────▶ --bg-elevated
--color-neutral-700  ───────▶ --border-subtle
--color-neutral-400  ───────▶ --border-strong, --text-muted
--color-neutral-50   ───────▶ --text-primary
--color-accent-default ─────▶ --accent, --focus-ring
```

**Regla de consumo: los componentes consumen la capa semántica.** Un componente
que escribe `var(--color-neutral-900)` en lugar de `var(--bg-surface)` acopla su
apariencia a una posición de la escala, no a un rol. Cuando la escala se ajuste
—y se ajustará, porque es una escala de marca, no un estándar— ese componente se
desincroniza del resto del sistema sin que nada lo señale.

La excepción documentada y aceptada son los estados de interacción
(`--color-accent-hover`, `--color-accent-active`), que hoy se consumen
directamente porque la capa semántica no expone aún tokens de estado por rol. Se
ve en [`_base.scss`](../../src/styles/base/_base.scss#L15-L16), donde el
`:hover` de `a` usa `var(--color-accent-hover)` mientras el estado base usa
`var(--accent)`. Es una asimetría conocida, no un descuido; ver §7.

No existe una tercera capa de tokens por componente (`--button-background-hover`
y similares). Con cero componentes implementados, introducirla sería abstracción
anticipada; la decisión se difiere hasta que dos componentes distintos necesiten
el mismo token de rol con valores divergentes.

### 2.3 Inventario de archivos

| Archivo                       | Emite CSS | Contenido                                                                                  |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `tokens/_fonts.scss`          | Sí        | `@font-face` de las familias autoalojadas + `--font-display`, `--font-sans`, `--font-mono` |
| `tokens/_colors.scss`         | Sí        | Escala neutral, acento y estados, elevación, bordes, texto, overlays y sombras             |
| `tokens/_typography.scss`     | Sí        | Escala de tamaños fluida, interlineado, tracking y medida de línea                         |
| `tokens/_spacing.scss`        | Sí        | Radios, grosores de borde, escala de espaciado y constantes de layout                      |
| `tokens/_motion.scss`         | Sí        | Duraciones, curva de easing y factores de escala de interacción                            |
| `tokens/_breakpoints.scss`    | **No**    | Mapa SCSS `$breakpoints` — única excepción al formato CSS (§2.10)                          |
| `abstracts/_breakpoints.scss` | **No**    | Mixins `up`/`down`/`between` y atajos por dispositivo que consumen el mapa                 |
| `base/_reset.scss`            | Sí        | Reset moderno, sin dependencia de tokens                                                   |
| `base/_base.scss`             | Sí        | Aplicación de tokens a elementos HTML nativos                                              |
| `index.scss`                  | Sí        | Punto de entrada: ordena la cascada                                                        |

Dos archivos comparten el nombre `_breakpoints.scss` en directorios distintos, y
la distinción importa: el de `tokens/` es el dato, el de `abstracts/` es el
comportamiento. Es exactamente la frontera que ADR 0004 definió, y el par de
archivos es el caso canónico que la ilustra.

### 2.4 Orden de composición y cascada

[`src/styles/index.scss`](../../src/styles/index.scss) fija un orden que **no es
arbitrario y no debe reordenarse sin entender qué se rompe**:

```text
@use "base/reset";        // 1. Neutraliza el user-agent stylesheet
@use "tokens/fonts";      // 2. @font-face + familias
@use "tokens/colors";     // 3. ┐
@use "tokens/typography"; // 4. ├ Definición de custom properties
@use "tokens/spacing";    // 5. │
@use "tokens/motion";     // 6. ┘
@use "base/base";         // 7. Aplica los tokens a elementos nativos
```

Dos invariantes dependen de este orden:

1. **Los tokens se declaran antes de consumirse.** Aunque las custom properties
   se resuelven en cascada y no por orden textual dentro de `:root`, `base/base`
   contiene reglas —no declaraciones de variables— que dependen de que los
   tokens existan en el mismo documento.
2. **`reset` va primero para perder deliberadamente la especificidad.** El reset
   declara `:focus-visible { outline: 2px solid currentColor }` con valores
   literales; `base/base` declara el mismo selector con
   `outline: var(--border-width-ring) solid var(--focus-ring)`. Misma
   especificidad, gana el último: el foco tokenizado. Si se invirtiera el orden,
   el sistema entero perdería el anillo de foco de marca y volvería a
   `currentColor` sin que ningún test lo detecte.

El reset no consume tokens **por diseño**: es la única capa que debe poder
existir sin ellos, para que cargarlo aislado (por ejemplo, en un entorno de test
que no monta los estilos completos) no produzca un documento con `var()` sin
resolver.

### 2.5 Convención de nomenclatura

El patrón es `--<familia>-<rol|escala>[-<variante>]`, en minúsculas y
kebab-case:

- **Escalas numéricas** donde el número codifica posición, no unidad:
  `--color-neutral-500`, `--space-4`, `--dur-200`. En `--dur-*` y `--space-*` el
  número sí es el valor (`--dur-200: 200ms`, `--space-4: 1rem = 16px`), lo que
  hace el token autoexplicativo al leerlo en una regla.
- **Roles semánticos** donde el nombre describe la función: `--bg-canvas`,
  `--text-muted`, `--border-subtle`, `--focus-ring`.
- **Estados como sufijo**: `--color-accent-hover`, `--color-accent-active`,
  `--color-accent-disabled`.

La escala de espaciado es **deliberadamente incompleta**:
`1, 2, 3, 4, 6, 8, 12, 16, 24, 32`. Los huecos (no hay `--space-5`, `--space-7`)
no son un olvido, son el mecanismo que impide el ajuste arbitrario. Si un
espaciado necesita 20px, la pregunta correcta es si el diseño está bien, no si
falta un token.

**Colisión conocida en el prefijo `--text-`.** El prefijo designa dos familias
distintas: color de texto (`--text-primary`, `--text-body`, `--text-muted`) y
tamaño de texto (`--text-h1`, `--text-small`). El síntoma es visible en el
propio código: el tamaño del cuerpo tuvo que llamarse `--text-body-size` porque
`--text-body` ya estaba ocupado por un color. Leer `var(--text-h3)` no permite
saber si devuelve un color o una longitud sin abrir el archivo de tokens. Está
registrado en §7.

### 2.6 Color

**Estructura.** Una escala neutral de once pasos (`50`–`950`) más un acento con
sus cuatro estados. Todo lo semántico deriva de ahí por `var()`.

**Verificación de contraste.** Las combinaciones del sistema, calculadas sobre
los valores actuales (ratio WCAG 2.x):

| Par                                                      | Ratio     | Umbral relevante                              |
| -------------------------------------------------------- | --------- | --------------------------------------------- |
| `--text-primary` sobre `--bg-canvas`                     | 18.14 : 1 | AAA texto normal (7:1)                        |
| `--text-body` sobre `--bg-canvas`                        | 16.11 : 1 | AAA                                           |
| `--text-secondary` sobre `--bg-canvas`                   | 9.92 : 1  | AAA                                           |
| `--text-muted` sobre `--bg-canvas`                       | 7.10 : 1  | AAA (por 0.10)                                |
| `--text-muted` sobre `--bg-elevated`                     | 5.72 : 1  | AA (4.5:1); **no** AAA                        |
| `--accent` sobre `--bg-canvas`                           | 7.80 : 1  | AAA                                           |
| `--text-on-accent` sobre `--accent`                      | 7.27 : 1  | AAA                                           |
| `--color-accent-active` sobre `--bg-canvas`              | 5.80 : 1  | AA                                            |
| `--color-accent-disabled-ink` sobre la superficie exenta | 4.55 : 1  | AA — coincide con lo anotado en el código     |
| `--focus-ring` sobre `--bg-elevated`                     | 6.29 : 1  | AA no-textual (3:1) con margen                |
| `--border-subtle` sobre `--bg-canvas`                    | 1.56 : 1  | **Decorativo** — no apto como único indicador |

El dato operativo: `--text-muted` deja de cumplir AAA al subir de elevación
(7.10 → 5.72). Sobre `--bg-elevated` sigue cumpliendo AA, que es el objetivo del
sistema, pero no hay nada que lo verifique automáticamente si la escala cambia.

`--border-subtle` con 1.56:1 es intencional —es una separación visual, no un
borde de control— pero implica que **no puede ser el único indicador del límite
de un campo de formulario**. Para eso está `--border-strong` (7.10:1).

**El sistema es dark-only, sin modo claro.** No hay
`@media (prefers-color-scheme: light)` ni conmutador por atributo. Los tokens
semánticos son el punto de extensión que lo haría posible sin reescribir
componentes, pero la indirección solo funciona donde se usó `var()`: dos tokens
copian el literal en lugar de aliasar
([`_colors.scss:19-21`](../../src/styles/tokens/_colors.scss#L19-L21)), de modo
que redefinir `--color-accent-default` o `--color-neutral-700` no los arrastra.
Es deuda acotada y está en §7.

**Overlays y gradientes son tokens de primer nivel.** `--scrim-nav` y
`--fade-card` encapsulan gradientes multiparada completos. La alternativa
—reconstruir el gradiente en cada componente— garantiza deriva visual entre
superficies que deberían ser idénticas.

### 2.7 Tipografía

**Familias autoalojadas.** `Averia Libre` (display, peso fijo 400) e `Inter`
(variable, `100 900`) se sirven desde `src/assets/fonts/` en WOFF2 con
`font-display: swap`. Autoalojar evita una petición a terceros y la dependencia
de disponibilidad externa (coherente con ADR 0003). `Inter` variable cubre todo
el rango de pesos en un único archivo.

**Escala fluida con `clamp()`, sin media queries.** Cada tamaño interpola entre
un ancla inferior y una superior en función del viewport:

```scss
--text-h2: clamp(2rem, 1.629rem + 1.581vw, 3.052rem);
//               │      └── recta de interpolación ──┘ │
//               └── suelo (móvil)          techo (desktop) ──┘
```

El término `rem` del medio es innecesario para el cálculo visual pero
imprescindible para la accesibilidad: una expresión de solo `vw` ignora el
tamaño de fuente del navegador y bloquea el zoom de texto. Con el término `rem`
presente, la preferencia del usuario sigue afectando al resultado.

**Anclas verificadas.** Recalculando cada `clamp()`, la serie `h2`–`h6`
interpola exactamente entre **375px y 1440px** de viewport, y en el ancla
superior forma una progresión geométrica de razón **1.25** (tercera mayor)
partiendo de 20px: 20 → 25 → 31.25 → 39.06 → 48.83 → 61.04. En el ancla inferior
los pasos son irregulares (1.111 → 1.2 → 1.167 → 1.143 → 1.25), un ajuste manual
para comprimir la jerarquía en móvil sin que `h1` desborde. Dos tokens se salen
de la serie —`h1` y `body`—; los números están en §7.

**Tres ejes por cada tamaño, no uno.** El sistema separa tamaño (`--text-*`),
interlineado (`--leading-*`), tracking (`--tracking-*`) y medida de línea
(`--measure-*`). El interlineado decrece al crecer el tamaño (1.05 en display,
1.6 en cuerpo) y el tracking se vuelve negativo en los tamaños grandes
(`-0.02em`) y positivo en los pequeños (`0.01em` en caption, `0.08em` en
overline): es compensación óptica estándar, y tokenizarla evita que cada
componente la reinvente o la omita.

Los tokens `--measure-*` están en `ch`, unidad relativa al ancho del carácter
`0` de la fuente activa, de modo que `--measure-body: 68ch` mantiene la longitud
de línea en el rango legible aunque cambie el tamaño de fuente.

### 2.8 Espaciado, radio y constantes de layout

Escala de espaciado en `rem` con el equivalente en píxeles anotado, base 4px.
`rem` es obligatorio aquí, no estilístico: el espaciado en `px` no escala con la
preferencia de fuente del usuario y produce layouts donde el texto crece pero su
contenedor no.

La excepción son los tokens cuyo contrato es físico, no tipográfico:

- `--radius-*` en `px` (2–16): un radio debe verse igual con cualquier tamaño de
  fuente; en `rem` un usuario con base a 24px obtendría esquinas
  desproporcionadas.
- `--border-width-hairline: 1px`, `--border-width-ring: 2px`,
  `--focus-ring-offset: 2px`: grosores de línea.
- `--hit-min: 44px`: área mínima de toque. Es un mínimo de accesibilidad
  absoluto (WCAG 2.5.8 exige 24×24 CSS px; 44px es el criterio más estricto de
  las guías de plataforma móvil) y debe permanecer invariante.
- `--nav-height: 68px`, `--page-max: 1180px`, `--screen-width: 1440px`:
  constantes de layout. `--screen-width` documenta el viewport de referencia del
  diseño y coincide con el ancla superior de la escala tipográfica (§2.7).
- `--ratio-card` y `--ratio-media`: relaciones de aspecto para `aspect-ratio`.
  `16 / 12.5` no es un ratio estándar; es una proporción de marca y por eso
  existe como token en lugar de aparecer suelto en un componente.

### 2.9 Movimiento

Cuatro duraciones (`--dur-120`, `--dur-200`, `--dur-320`, `--dur-500`) nombradas
por su valor, una única curva (`--ease-standard`) y cuatro factores de escala
para interacción (`--zoom-thumb: 1.06`, `--zoom-gallery: 1.03`,
`--zoom-card: 1.02`, `--press-scale: 0.995`).

Una sola curva de easing es deliberado: la coherencia de movimiento de un
sistema depende más de usar siempre la misma curva que de tener un catálogo. Las
curvas de entrada/salida diferenciadas se añadirán cuando un componente real las
necesite.

Los factores de zoom son deliberadamente sutiles y decrecen con el tamaño del
elemento (miniatura 6%, galería 3%, tarjeta 2%): un mismo porcentaje aplicado a
superficies de distinto tamaño no produce la misma sensación de desplazamiento.

**Interacción con `prefers-reduced-motion`.** No hay que gestionarla por
componente: [`_reset.scss:302-311`](../../src/styles/base/_reset.scss#L302-L311)
colapsa globalmente duraciones de animación y transición a `0.01ms` con
`!important` bajo `prefers-reduced-motion: reduce`. La consecuencia que hay que
conocer es que **eso neutraliza duraciones, no transformaciones**: una animación
por `@keyframes` que desplace un elemento seguirá saltando a su estado final, y
un `transform: scale(var(--zoom-card))` aplicado sin transición permanece
activo. Para movimiento significativo (parallax, autoplay, desplazamiento
amplio) hay que consultar la media query explícitamente.

### 2.10 Breakpoints: la excepción justificada

`tokens/_breakpoints.scss` es el único token que **no** es una custom property:

```scss
$breakpoints: (
  'mobile': 320px,
  'tablet': 768px,
  'desktop': 1024px,
);
```

La razón es una limitación del lenguaje, no una preferencia: **`var()` no es
válido en el prelude de una media query.** `@media (width >= var(--bp-tablet))`
no funciona en ningún navegador. La especificación de `@custom-media` (Media
Queries 5) resolvería el caso, pero no está implementada.

El consumo vive en `abstracts/_breakpoints.scss`, que no emite CSS y por tanto
puede importarse desde cualquier componente sin duplicar reglas en el bundle
—propiedad crítica bajo el modelo de estilos colocalizados de ADR 0004—. Tres
decisiones de ese módulo merecen atención:

1. **Media queries en `em`, no en `px`.** Con `px`, un usuario con la base
   tipográfica a 20px seguiría recibiendo el layout de móvil en una pantalla
   ancha. La conversión la hace `_em()` contra `$root-font-size: 16px`.
2. **`$_step: 0.02px`** desplaza el límite superior de `down()` y `between()`
   para que no solapen con `up()` en el mismo píxel. El valor es 0.02 y no 1
   porque los navegadores admiten dimensiones fraccionarias; 0.02px es el
   incremento seguro más pequeño frente a errores de redondeo.
3. **`mobile` no abre media query.** Es el estado base del sistema
   (_mobile-first_): el mixin `mobile` cubre todo por debajo de `tablet`, y el
   valor `320px` del mapa documenta el viewport mínimo soportado sin generar un
   breakpoint de entrada.

Nótese que ese mínimo soportado (320px) **no coincide** con el ancla inferior de
la escala tipográfica (375px, §2.7). No es un error —`clamp()` mantiene el valor
mínimo por debajo del ancla— pero significa que entre 320px y 375px la
tipografía está congelada mientras el layout sigue siendo fluido.

### 2.11 Puente hacia el tema de Storybook

El chrome de Storybook (barras, controles, fondo del manager) se configura con
un objeto JavaScript, no con CSS, y se evalúa en un contexto donde las custom
properties del documento de preview no están disponibles.
[`src/ui/theme/Angustia/Angustia.ts`](../../src/ui/theme/Angustia/Angustia.ts)
resuelve esto **copiando los valores literales y anotando en un comentario el
token del que proceden**:

```ts
colorPrimary: '#6EA8DA' /* --color-accent-default */,
appBg: '#080A0F' /* --bg-canvas */,
```

Es duplicación consciente. La alternativa —generar el objeto leyendo el SCSS en
build time— exige un pipeline de tokens (§4) que hoy no existe y que no se
justifica por un único consumidor. El comentario de trazabilidad es lo que
convierte la duplicación en mantenible: cualquier cambio de paleta obliga a un
`grep` del token en `src/ui/theme/`. Nada lo verifica automáticamente; está en
§7.

`Angustia` se aplica en dos superficies distintas y hace falta declararlo en las
dos: `manager.ts` (chrome de la aplicación) y el parámetro `docs.theme` de
`preview.ts` (páginas de documentación). Configurar solo el manager deja las
páginas de docs con el tema por defecto de Storybook.

## 3. Guía de consumo

**Todo valor visual de un componente sale de un token.** Un literal en un
archivo de componente (`#6ea8da`, `12px`, `200ms`) es una anomalía que debe
justificarse en la revisión, no un atajo aceptable.

```scss
// src/ui/base/button/Button.scss
@use '@/styles/abstracts/breakpoints' as bp;

.lds-button {
  // Capa semántica para color; escala directa para espaciado y forma.
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: var(--border-width-hairline) solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  min-block-size: var(--hit-min); // no negociable
  font-family: var(--font-sans);
  font-size: var(--text-body-size);
  line-height: var(--leading-body);
  transition: background var(--dur-120) var(--ease-standard);

  &:hover {
    background: var(--color-accent-hover);
  }

  @include bp.desktop {
    padding-inline: var(--space-6);
  }
}
```

Reglas operativas:

- **Color → capa semántica** (`--bg-*`, `--text-*`, `--border-*`, `--accent`).
  Nunca `--color-neutral-*` directamente.
- **Espaciado y forma → escala directa** (`--space-*`, `--radius-*`). No hay
  capa semántica y no se necesita.
- **Breakpoints → mixins de `abstracts/`**, nunca `@media` a mano. Los mixins
  garantizan la unidad `em` y el manejo del solape.
- **Foco → no tocar.** El anillo global de `base/base` ya es tokenizado y
  accesible. Redefinirlo por componente rompe la consistencia del sistema.
- **Falta un token → se añade a `tokens/`**, no al componente. Si el valor solo
  sirve a un componente, probablemente no es un token; pero tampoco debería ser
  un literal sin comentario que explique por qué es local.

**Lectura desde JavaScript**, cuando un componente necesite un valor en tiempo
de ejecución (por ejemplo, sincronizar una animación imperativa con
`--dur-320`):

```ts
const duracion = getComputedStyle(document.documentElement)
  .getPropertyValue('--dur-320')
  .trim(); // "320ms"
```

Es el motivo por el que el formato es CSS y no SCSS: con variables SCSS este
acceso no existe.

## 4. Alternativas consideradas

| Alternativa                                                  | Por qué se descartó                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Variables SCSS (`$token`) como formato principal**         | Se resuelven en compilación: no son inspeccionables, no se pueden sobreescribir por contexto ni leer desde JS, y un consumidor del paquete no podría redefinir la marca sin recompilar el sistema.                                                       |
| **Pipeline de tokens (Style Dictionary, Tokens Studio)**     | Resuelve el puente a JS (§2.11) y la sincronización con Figma, pero añade dependencia, paso de build y formato fuente en JSON. Con un tema, un mantenedor y cero componentes, el costo supera al beneficio. Reevaluable (§8).                            |
| **Tres capas (primitiva → semántica → componente)**          | Abstracción anticipada sin componentes que la ejerzan. La tercera capa se añade cuando dos componentes necesiten el mismo rol con valores distintos.                                                                                                     |
| **Escala tipográfica por breakpoints en lugar de `clamp()`** | Produce saltos visibles en los límites y multiplica las reglas por cada tamaño. `clamp()` da una curva continua con una sola declaración y es Baseline desde 2020.                                                                                       |
| **Tokens de color en OKLCH**                                 | Mejor uniformidad perceptual para generar escalas, pero la paleta viene fijada por marca en hex y no se está generando programáticamente. El comentario «Escala de color OKLCH» del archivo refleja la intención de autoría, no el formato emitido (§7). |
| **`@custom-media` para breakpoints**                         | Resolvería la excepción de §2.10 con un formato homogéneo, pero no está implementado en ningún navegador.                                                                                                                                                |
| **Tema claro desde el inicio**                               | No hay requisito. La arquitectura semántica deja la puerta abierta; construirlo sin necesidad duplica el coste de verificación de contraste de cada par.                                                                                                 |

## 5. Consecuencias

**Positivas**

- Contrato visual único y verificable: cualquier cambio de marca se aplica en
  `tokens/` y se propaga a todo el sistema.
- Sobreescritura por consumidor sin recompilar, y por contexto (contenedor,
  atributo, media query) sin duplicar reglas.
- La capa semántica hace viable un segundo tema sin tocar componentes, siempre
  que se cierre la deuda de los alias literales (§7).
- Tipografía y espaciado respetan la preferencia de tamaño de fuente del
  usuario; los breakpoints también, al emitirse en `em`.
- `abstracts/` no emite CSS: importarlo desde N componentes no duplica nada en
  el bundle.
- Accesibilidad con datos, no con intuición: los ratios de §2.6 son
  reproducibles y los umbrales están documentados.

**Negativas / costos aceptados**

- **Sin validación en build time.** Un token mal escrito compila y falla en
  silencio en el navegador. No hay linter de CSS en el stack (ADR 0006 cubre
  TS/JS).
- **Duplicación de valores en `Angustia.ts`**, mitigada solo por comentarios de
  trazabilidad.
- **Sin sincronización con la herramienta de diseño.** La paleta y la escala se
  transcriben a mano; la deriva es posible y no se detecta automáticamente.
- **El orden de `index.scss` es una invariante frágil**: reordenar las líneas
  compila sin error y degrada el foco (§2.4).
- **La ergonomía del contrato no está validada.** Los tokens se diseñaron sin
  componentes que los ejercieran; es esperable que los primeros componentes
  reales revelen huecos (pesos tipográficos, z-index, tokens de estado por rol).

## 6. Estado de la implementación (2026-09-20)

| Área                                  | Estado                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| Familias tipográficas y `@font-face`  | Implementado                                                          |
| Tokens de color (escala + semántica)  | Implementado                                                          |
| Tokens tipográficos                   | Implementado — dos anclas fuera de serie (§7)                         |
| Espaciado, radios, constantes         | Implementado                                                          |
| Movimiento                            | Implementado                                                          |
| Breakpoints (mapa + mixins)           | Implementado                                                          |
| Aplicación a elementos nativos        | Implementado (`base/base`)                                            |
| Tema de Storybook `Angustia`          | Implementado — `manager.ts` y `docs.theme` en `preview.ts`            |
| Consumo en componentes reales         | **Sin validar** — solo `TestComponent.scss` usa dos tokens de familia |
| Inyección global en SCSS (LDS-31)     | **Pendiente** — `additionalData` sigue comentado en `vite.config.ts`  |
| Tokens de peso tipográfico y z-index  | **No existen**                                                        |
| `styles/theme/` previsto por ADR 0004 | **No creado** — el único tema vive en `src/ui/theme/` (§7)            |

## 7. Pendientes y riesgos abiertos

1. **Dos anclas tipográficas fuera de la serie.** Recalculando los `clamp()`:
   `--text-h1` satura su valor máximo en **1269px** de viewport en lugar de
   1440px (su pendiente es `2.352vw`; la coherente con el resto de la serie
   sería ≈1.976vw), y `--text-body-size` no alcanza sus 18px hasta **1553px**,
   de modo que en el viewport de diseño de 1440px vale **17.81px**. El efecto
   visual es menor, pero rompe la proporción de la escala justo en el ancho de
   referencia. Corregir exige recalcular intercepto y pendiente de ambos tokens
   contra el par 375/1440px.
2. **Dos tokens semánticos copian el literal en lugar de aliasar.**
   `--color-accent-focus: #6ea8da` y `--color-accent-disabled: #2c3340` repiten
   valores que ya existen como `--color-accent-default` y `--color-neutral-700`.
   Redefinir la primitiva no los arrastra, que es precisamente lo que la capa
   semántica debía garantizar. Sustituir por `var()`.
3. **Colisión del prefijo `--text-`** entre colores y tamaños (§2.5). Renombrar
   la familia de tamaños (`--font-size-*`) o la de colores (`--fg-*`) es un
   cambio incompatible: barato ahora, caro con N componentes publicados.
4. **Falta `color-scheme: dark` en `:root`.** El sistema es dark-only pero no lo
   declara, así que los controles nativos del navegador (scrollbars, `select`,
   selectores de fecha) se renderizan en claro sobre la UI oscura. Es una línea
   en `base/base` y no requiere tokens nuevos.
5. **No existen tokens de peso tipográfico ni de z-index.** `Inter` está cargada
   como variable (`100 900`) sin que ningún token exponga los pesos del sistema,
   y el apilamiento de overlays/modales no tiene escala pese a que ya hay tokens
   de overlay y sombra. Ambos aparecerán en cuanto se implemente el primer
   componente con capas.
6. **Deriva potencial entre `Angustia.ts` y la paleta.** Nada verifica que los
   literales del tema sigan coincidiendo con los tokens que citan sus
   comentarios. Mitigación de bajo costo: un test que parsee ambos archivos y
   compare, ejecutable en el proyecto `jsdom` de Vitest (ADR 0008).
7. **`additionalData` de SCSS sin configurar (LDS-31).** Sigue comentado en
   `vite.config.ts`. Con el formato actual la inyección global **no es necesaria
   para los tokens CSS** —se declaran una vez en `:root`—, pero sí evitaría
   repetir el `@use` de `abstracts/breakpoints` en cada componente. Si se
   activa, hay que crear antes un `tokens/_index.scss` con los `@forward`
   correspondientes: hoy no existe, de modo que `@use "@/styles/tokens"`
   fallaría. Advertencia: inyectar un archivo que emita CSS duplicaría reglas en
   cada unidad compilada; solo son inyectables módulos sin salida.
8. **Sin linter de CSS.** Un `stylelint` con `custom-property-pattern` y una
   regla que prohíba literales de color en `src/ui/**` convertiría en error de
   CI las anomalías que hoy solo detecta la revisión humana. Fuera del alcance
   de ADR 0006.
9. **`styles/theme/` previsto por ADR 0004 no existe.** El único tema es el de
   Storybook y vive en `src/ui/theme/Angustia/`, que es coherente (es
   configuración de herramienta, no estilo de producto), pero deja la estructura
   real divergiendo de la documentada en ADR 0004, README y `src/README.md`. Hay
   que cerrar la divergencia en un sentido o en el otro.
10. **`src/index.scss` es scaffolding huérfano.** No lo importa nadie
    (`main.tsx` y `preview.ts` cargan `@/styles/index.scss`), pero define
    `--accent`, `--text` y `--border` con valores ajenos al sistema. Si algún
    import lo reintrodujera, sobreescribiría `--accent` con `#aa3bff`. Debe
    eliminarse junto con el resto del scaffolding (ADR 0007 §8).
11. **Ergonomía sin validar.** El contrato completo no ha sido ejercido por
    ningún componente real. Este ADR debe revisarse tras los tres primeros.

## 8. Condiciones de invalidación

Esta decisión debe revisarse si:

- **Aparece un segundo tema** (claro, alto contraste o de marca alternativa). Se
  vuelve obligatorio cerrar el pendiente 2 y decidir el mecanismo de conmutación
  (`prefers-color-scheme`, atributo en el raíz, o ambos), además de reverificar
  cada par de contraste de §2.6.
- **Los tokens deben consumirse fuera de CSS** (React Native, email, generación
  de imágenes, o más de un consumidor del objeto de tema). El formato CSS deja
  de ser suficiente como fuente única y se justifica el pipeline descartado en
  §4.
- **La paleta pasa a generarse programáticamente** (por ejemplo, derivando la
  escala en OKLCH desde un color de marca). El formato fuente deja de ser hex
  escrito a mano.
- **La deriva entre `Angustia.ts` y los tokens produce un bug visible** antes de
  que exista el test del pendiente 6: es la señal de que la duplicación manual
  dejó de ser sostenible.
- **El número de tokens semánticos por rol crece hasta requerir capa de
  componente** (dos o más componentes necesitando el mismo rol con valores
  divergentes), lo que reabre la decisión de §2.2.
- **Se detectan literales de color o espaciado recurrentes** en los componentes
  de `src/ui/`, lo que indica que el catálogo tiene huecos reales o que su
  ergonomía no es suficiente, y motiva tanto ampliar los tokens como automatizar
  la prohibición (pendiente 8).

## 9. Referencias

- CSS Custom Properties for Cascading Variables (Nivel 1):
  <https://www.w3.org/TR/css-variables-1/>
- MDN — Uso de custom properties:
  <https://developer.mozilla.org/docs/Web/CSS/CSS_cascading_variables/Using_CSS_custom_properties>
- MDN — `clamp()`: <https://developer.mozilla.org/docs/Web/CSS/clamp>
- MDN — `color-scheme`:
  <https://developer.mozilla.org/docs/Web/CSS/color-scheme>
- MDN — `prefers-reduced-motion`:
  <https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion>
- WCAG 2.2 — 1.4.3 Contraste mínimo:
  <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- WCAG 2.2 — 1.4.11 Contraste de elementos no textuales:
  <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- WCAG 2.2 — 2.5.8 Tamaño del objetivo (mínimo):
  <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- WCAG 2.2 — 1.4.4 Redimensionar texto (unidades relativas):
  <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>
- Media Queries Level 5 — `@custom-media` (no implementado):
  <https://www.w3.org/TR/mediaqueries-5/#custom-mq>
- Sass — `@use` y sistema de módulos:
  <https://sass-lang.com/documentation/at-rules/use/>
- Storybook — theming del manager y de docs:
  <https://storybook.js.org/docs/configure/user-interface/theming>
- ADR 0004 — Estructura de directorios:
  [`0004-project-structure.md`](./0004-project-structure.md)
- ADR 0007 — Storybook: [`0007-storybook.md`](./0007-storybook.md)
