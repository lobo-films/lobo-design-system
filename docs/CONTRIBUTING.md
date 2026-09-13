# Guía de contribución — Lobo Design System

Este documento define las convenciones obligatorias para contribuir al
repositorio.

**Alcance actual:** nomenclatura de ramas, reglas de protección y uso de la
plantilla de Pull Request. Las convenciones de mensajes de commit, política de
revisión y versionado están marcadas como pendientes al final.

---

## 1. Reglas fundamentales

1. **Está prohibido hacer push directo a `main`.** Todo cambio entra
   exclusivamente mediante Pull Request. No hay excepciones por urgencia: un
   hotfix también pasa por PR.
2. Toda rama de trabajo debe cumplir el patrón de nomenclatura definido en §2.
3. Una rama corresponde a un solo ticket. Si el trabajo se divide, se divide el
   ticket.
4. Las ramas `poc/` nunca se mergean (§4).
5. Las ramas de automatización no se crean manualmente (§3.2).
6. Todo PR usa la plantilla completa: ninguna sección se elimina y las que no
   aplican se marcan como `N/A` (§5).

---

## 2. Nomenclatura de ramas

### 2.1 Patrón

```
^(feature|bugfix|hotfix|docs|poc|arch)/LDS-[1-9][0-9]{0,3}(-[a-z0-9]+)*$
```

Estructura: `<tipo>/LDS-<ticket>[-<descripción>]`

| Componente      | Regla                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `<tipo>`        | Uno de los seis prefijos permitidos. Siempre en minúsculas.                                         |
| `LDS`           | Clave del proyecto (Lobo Design System). **Siempre en mayúsculas.**                                 |
| `<ticket>`      | De 1 a 4 dígitos. Sin ceros a la izquierda. `LDS-0` no es válido.                                   |
| `<descripción>` | Opcional. Minúsculas, dígitos y guiones. Sin acentos, sin `ñ`, sin guiones dobles, sin guion final. |

El patrón es sensible a mayúsculas y minúsculas.

### 2.2 Tipos de rama

| Prefijo   | Uso                                                                         | Criterio de decisión                                                                                          |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `feature` | Componentes nuevos, tokens, APIs públicas, funcionalidades.                 | Agrega superficie nueva al sistema.                                                                           |
| `bugfix`  | Corrección de defectos que entra por el flujo normal de release.            | El fix requiere diseño, toca varios componentes o necesita revisión amplia. Puede esperar al siguiente ciclo. |
| `hotfix`  | Corrección urgente y acotada.                                               | El fix es localizado, de bajo riesgo de regresión, y no puede esperar al siguiente ciclo.                     |
| `docs`    | Documentación: README, guías de uso, MDX de Storybook, ADRs, este archivo.  | El cambio no altera comportamiento en runtime ni el bundle publicado.                                         |
| `poc`     | Pruebas de concepto y exploraciones técnicas.                               | **Nunca se mergea.** Ver §4.                                                                                  |
| `arch`    | Estructura del repositorio, build, tooling, CI/CD, refactors transversales. | Cambia cómo está organizado o construido el proyecto, no qué expone.                                          |

**Criterio normativo.** La distinción entre `bugfix` y `hotfix` se define por
**urgencia y alcance del cambio**, no por el tamaño del bug. El tamaño es un
criterio subjetivo y produce clasificaciones inconsistentes entre personas
distintas; la urgencia y el alcance son verificables contra el ticket y el diff.

En la práctica, la pregunta que resuelve la clasificación es: _¿puede esperar al
siguiente ciclo de release?_ Si la respuesta es sí, es `bugfix`. Si es no y
además el cambio está acotado a pocos archivos con bajo riesgo de regresión, es
`hotfix`. Un defecto urgente pero de alcance amplio no es un `hotfix`: es un
`bugfix` que debe priorizarse, porque el riesgo de introducir una regresión
mayor bajo presión de tiempo supera el beneficio de publicarlo antes.

**Caso ambiguo frecuente.** Un cambio que corrige un defecto _y_ modifica la API
pública se clasifica como `feature`: para quien consume el design system, un
cambio de contrato no es una corrección.

### 2.3 Reglas de estilo para la descripción

La descripción es opcional, pero cuando se usa:

- Máximo 4 o 5 palabras. El nombre completo de la rama no debería superar los 60
  caracteres.
- Describe **qué** se hace, no cómo ni para quién:
  `feature/LDS-22-tokens-de-color`, no
  `feature/LDS-22-cambios-pedidos-por-diseno`.
- No debe empezar con dígitos. `feature/LDS-22-33` es técnicamente válido según
  el patrón, pero hace ambiguo dónde termina el ticket y dónde empieza la
  descripción. Evítalo.
- No reemplaza al título del PR ni al ticket. Es un ayuda-memoria para leer
  `git branch`, no documentación.

### 2.4 Ejemplos válidos

```
feature/LDS-22-prueba-para-web
feature/LDS-1
feature/LDS-137-boton-variantes
bugfix/LDS-42-foco-visible-en-modal
hotfix/LDS-9
docs/LDS-1204-guia-de-tokens
poc/LDS-880-virtualizacion-de-tabla
arch/LDS-3-migracion-a-nx
```

### 2.5 Ejemplos inválidos

| Rama                          | Motivo                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| `feature/LDS-0`               | `0` no es un ticket válido.                                        |
| `feature/LDS-007`             | Ceros a la izquierda: genera ramas distintas para el mismo ticket. |
| `feature/LDS-12345`           | Excede 4 dígitos.                                                  |
| `feature/lds-42`              | Clave del proyecto en minúsculas.                                  |
| `feature/LDS42`               | Falta el guion separador.                                          |
| `feat/LDS-42`                 | Prefijo fuera de la lista permitida.                               |
| `Feature/LDS-42`              | Prefijo con mayúscula.                                             |
| `feature/LDS-42-Botón-Nuevo`  | Mayúsculas y acentos en la descripción.                            |
| `feature/LDS-42-boton--nuevo` | Guion doble.                                                       |
| `feature/LDS-42-`             | Guion final.                                                       |
| `feature/LDS-42-boton_nuevo`  | Guion bajo en lugar de guion.                                      |
| `feature/LDS-42/boton`        | Segmento adicional.                                                |
| `LDS-42`                      | Falta el prefijo de tipo.                                          |

---

## 3. Ramas exentas del patrón

### 3.1 Ramas permanentes

`main` y la rama de integración no siguen el patrón de nomenclatura y están
protegidas. No se crean ni se eliminan como parte del trabajo diario, y ninguna
de las dos admite push directo.

`main` representa el estado publicado del design system: lo que hay en `main` es
lo que están consumiendo las aplicaciones.

### 3.2 Destino del Pull Request

| Tipo de rama                        | PR contra                             |
| ----------------------------------- | ------------------------------------- |
| `hotfix`                            | `main`                                |
| `feature`, `bugfix`, `docs`, `arch` | Rama de integración                   |
| `poc`                               | Rama de integración, sin mergear (§4) |

**Regla de sincronización obligatoria.** Un `hotfix` mergeado en `main` debe
propagarse a la rama de integración inmediatamente después del merge, antes de
retomar cualquier otro trabajo. Es responsabilidad de quien mergea el hotfix, no
de la siguiente persona que se tropiece con el problema.

Si esa propagación se omite, el fix desaparece en el siguiente release cuando la
rama de integración avance sobre `main`, y el defecto reaparece en producción
sin que ningún ticket lo explique. Es el modo de fallo más común de este modelo
y no lo detecta ningún check automático.

Si la propagación genera conflictos que no son triviales, se resuelven en una
rama con el mismo ticket del hotfix. No se resuelven a mano directamente sobre
la rama de integración, porque eso vuelve a ser un cambio sin revisión.

**Un `hotfix` no tiene checks reducidos.** Pasa por PR, por los mismos checks
requeridos y por revisión, igual que cualquier otro cambio. La urgencia
justifica saltarse la cola de priorización, no el control de calidad. Si un
cambio es tan urgente que no admite revisión, el problema está en la respuesta a
incidentes, no en esta convención.

### 3.3 Ramas de automatización

Las ramas `dependabot/*` y `renovate/*` están reservadas para los bots de
actualización de dependencias.

- **Ningún integrante del equipo debe crear ramas con estos prefijos de forma
  manual.** Están exentas de la validación de nomenclatura, por lo que usarlas
  manualmente evade el control de forma silenciosa.
- **Los PRs generados por bots los revisa y mergea un code owner.** No se
  habilita auto-merge sobre ellos, aunque todos los checks estén en verde. El
  motivo es que una actualización de dependencias en un design system puede
  alterar el output visual o el bundle publicado sin romper ninguna prueba, y
  esa evaluación requiere criterio humano sobre el impacto en los consumidores.
- El trabajo derivado de una actualización —por ejemplo, corregir el código que
  rompió— va en una rama propia con ticket, normalmente `arch/` o `bugfix/`. No
  se agregan commits correctivos a la rama del bot: el bot puede reescribirla al
  recalcular la actualización.

Cualquier otra excepción a la nomenclatura debe justificarse en el PR que la
introduce y documentarse aquí. Una lista de excepciones que crece sin revisión
vuelve inútil la regla.

---

## 4. Regla específica de `poc/`

Las ramas `poc/` existen para validar una hipótesis técnica, no para producir
código entregable.

- El PR se abre en **draft** y lleva la etiqueta **`do not merge`**.
- El merge está bloqueado mientras la rama sea `poc/` o la etiqueta esté
  presente.
- Al cerrar la exploración se documenta la conclusión en el PR —qué se probó,
  qué resultó, qué se descarta— y se abre un ticket nuevo, normalmente
  `feature/` o `arch/`, para la implementación real.
- El código de la PoC no se promueve tal cual: se reescribe. Una PoC optimiza
  para velocidad de aprendizaje, no para mantenibilidad.
- La rama se elimina al cerrar el PR. No se conserva como referencia; para eso
  está la conclusión escrita.

---

## 5. Plantilla de Pull Request

Todo PR se abre con la plantilla `.github/pull_request_template.md`, que GitHub
carga automáticamente en la descripción.

### 5.1 Ninguna sección se elimina

Todas las secciones de la plantilla deben estar presentes en la descripción del
PR, aunque el cambio no las necesite:

- `Summary`
- `Jira URL`
- `Description`
- `Type of change`
- `Validation Steps`
- `Evidence`
- `Impact`
- `Checks`

No se elimina, renombra ni reordena ninguna sección. Tampoco se eliminan ítems
de las listas `Impact` y `Checks`.

### 5.2 Secciones no aplicables se marcan como `N/A`

Cuando una sección no aplica al cambio, se conserva el encabezado y se escribe
`N/A` como contenido, acompañado de una justificación breve cuando el motivo no
sea evidente:

```markdown
## Evidence

N/A — cambio de documentación sin impacto visual.
```

En las listas de `Impact` y `Checks`, un ítem que no aplica se deja sin marcar y
se añade `N/A` al final de la línea:

```markdown
- [ ] Storybook levanta sin errores de consola — N/A, solo cambia `docs/`
```

Reglas complementarias:

- Una sección vacía, o que solo conserva los comentarios de la plantilla, **no
  equivale a `N/A`**: se considera incompleta. Los comentarios HTML no se ven en
  la vista renderizada del PR, así que el revisor no puede distinguirla de una
  omisión.
- `Summary`, `Jira URL` y `Type of change` aplican siempre y no admiten `N/A`.
- `Evidence` es obligatoria en todo PR con impacto visual; en ese caso tampoco
  admite `N/A`.

### 5.3 Motivo

Una estructura fija permite al revisor saber dónde buscar cada dato en cualquier
PR. Además, distingue entre _no aplica_ —una decisión explícita del autor— y _se
olvidó_. Si una sección se elimina, esa distinción desaparece y el revisor tiene
que reconstruir qué se evaluó y qué no.

---

## 6. Cómo se aplica la regla

La convención se valida en dos capas:

| Capa                 | Momento                     | Carácter                                                               |
| -------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Hook local           | Al hacer push               | Informativo. Da retroalimentación inmediata, pero se puede omitir.     |
| Integración continua | Al abrir o actualizar un PR | **Obligatorio.** Check requerido; un nombre inválido bloquea el merge. |

La protección de `main` bloquea el push directo a nivel de servidor y exige PR
con los checks requeridos en verde.

Si una rama ya fue publicada con un nombre inválido, se renombra localmente, se
elimina la rama remota anterior y se vuelve a publicar. Si el PR ya estaba
abierto, hay que cerrarlo y abrir uno nuevo: GitHub no permite cambiar la rama
origen de un PR existente.

---

## 7. Decisiones registradas

### 7.1 Tope de 4 dígitos

El patrón acepta hasta `LDS-9999`. Es suficiente para el estado actual del
proyecto, pero es un techo real: un design system con varios años de operación
puede superarlo. Cuando el contador se acerque a los cuatro dígitos, el límite
superior debe eliminarse del patrón. El cambio es retrocompatible: toda rama
válida hoy seguirá siéndolo.

### 7.2 Ceros a la izquierda

Se rechazan explícitamente. Sin esa restricción, `LDS-42`, `LDS-042` y
`LDS-0042` son ramas distintas para el mismo ticket, lo que rompe cualquier
automatización que derive el ID desde el nombre de la rama: changelogs, enlaces
al tracker, trazabilidad en releases.

### 7.3 Descripción opcional y no obligatoria

Se permite pero no se exige, para que el nombre siga siendo parseable de forma
determinista —tipo y ticket están en posición fija— sin perder legibilidad al
listar ramas. Obligarla añadiría discusiones de formato sin beneficio
proporcional; prohibirla haría ilegible `git branch -a` sin consultar el
tracker.

### 7.4 Prohibición de push a `main`

No es una preferencia de proceso, es lo que hace verificables todas las demás
reglas: sin ella, cualquier convención de ramas y cualquier check de CI son
opcionales en la práctica.

---

## 8. Pendiente

- Convención de mensajes de commit y su validación.
- Política de revisión de PRs: número de aprobaciones y criterios de bloqueo.
- Archivo `CODEOWNERS`: definición de propietarios por ruta y su asignación
  automática como revisores.
- Versionado y publicación del paquete.
- Requisitos de accesibilidad y cobertura de pruebas por tipo de contribución.
