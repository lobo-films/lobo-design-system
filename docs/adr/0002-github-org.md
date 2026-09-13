# 0002 — Organización de GitHub `lobo-films` en plan Free

| Campo                   | Valor                                                   |
| ----------------------- | ------------------------------------------------------- |
| **Estado**              | Aceptada                                                |
| **Fecha**               | 2026-09-11                                              |
| **Decisor**             | `Hipstha` (owner único)                                 |
| **Ámbito**              | Alojamiento de código, CI/CD y gobierno de repositorios |
| **Reemplaza a**         | —                                                       |
| **Relacionada con**     | 0001 (pendiente de referencia cruzada)                  |
| **Revisión programada** | 2027-03-01 o al cumplirse cualquier _trigger_ de la §8  |

---

## 1. Contexto

Lobo Films inicia su plataforma web y prevé una arquitectura de múltiples
repositorios (servicios y microservicios) bajo un mismo espacio de nombres. Hoy:

- Un solo actor humano: `Hipstha`, que concentra los roles de **owner de la
  organización, creador, code owner y responsable de políticas**.
- No hay equipo de desarrollo distribuido, ni requisitos de cumplimiento (SOC2,
  ISO 27001), ni SSO corporativo, ni necesidad de `CODEOWNERS` con aprobación
  obligatoria entre personas distintas.
- El volumen de CI es bajo y no hay entornos productivos multi-región ni
  despliegues que requieran _approval gates_ formales.
- Se estima alcanzar el nivel de madurez que justifique un plan de pago **en el
  transcurso del próximo año (~2027)**.

La decisión relevante no es "¿GitHub sí o no?", sino **qué contenedor
organizativo y qué nivel de plan** adoptar hoy sin generar trabajo de migración
cuando el equipo crezca.

## 2. Drivers de decisión

1. **Costo operativo cero** mientras el proyecto no genera ingresos.
2. **Namespace estable**: las URLs `github.com/lobo-films/<repo>` no deben
   cambiar al escalar (evitar renombres, _redirects_ y actualización de
   _remotes_, submódulos, `package.json`, imágenes de contenedor y pipelines).
3. **Separación identidad personal / identidad del proyecto**: propiedad de los
   repos a nombre de la organización, no de una cuenta personal.
4. **Reversibilidad**: el cambio de plan Free → Team debe ser una operación de
   facturación, no una migración técnica.
5. **Superficie de gobierno proporcional**: no introducir procesos (revisiones
   obligatorias, entornos con aprobadores) que un solo desarrollador no puede
   satisfacer sin auto-aprobarse.

## 3. Decisión

Se adopta una **organización de GitHub (`lobo-films`) en plan Free** como
contenedor único de todos los repositorios del proyecto, con `Hipstha` como
owner, y se **difiere la contratación de GitHub Team** hasta que se cumpla
alguno de los _triggers_ cuantificados de la §8.

Corolarios de la decisión:

- Todo repositorio nuevo se crea **dentro de la organización**, nunca en la
  cuenta personal, aunque sea un _spike_ o prototipo.
- Las políticas se aplican por configuración declarativa cuando sea posible
  (`.github` repo de organización, plantillas, `CODEOWNERS`, rulesets) para que
  el gobierno no dependa de memoria individual.
- Se asume explícitamente el **riesgo de owner único** y se mitiga según §7.

## 4. Alternativas consideradas

| Alternativa                                    | Costo                   | Namespace estable                                  | Gobierno multi-repo                                               | Migración futura                                             | Veredicto                                                                                             |
| ---------------------------------------------- | ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Cuenta personal + repos**                    | $0                      | No (`/Hipstha/*` → renombre obligatorio al crecer) | Nulo (sin teams, sin políticas org-wide)                          | Alta fricción: transferir N repos, romper _remotes_/imágenes | Rechazada                                                                                             |
| **Org Free** (elegida)                         | $0                      | Sí                                                 | Parcial (teams sí; algunas políticas limitadas en repos privados) | Cambio de plan, sin migración de datos                       | **Aceptada**                                                                                          |
| **Org Team desde el día 1**                    | ~4 USD/usuario/mes      | Sí                                                 | Completo                                                          | N/A                                                          | Rechazada: paga por controles que 1 persona no ejerce                                                 |
| **GitLab SaaS / self-hosted (Gitea, Forgejo)** | $0–variable + operación | Sí                                                 | Alto                                                              | Migración de ecosistema completo                             | Rechazada: costo de operación y pérdida del ecosistema Actions/Marketplace sin beneficio proporcional |
| **Monorepo único (Nx) en un repo**             | $0                      | Sí                                                 | Simplifica permisos                                               | —                                                            | Rechazada como estrategia global; no excluida para el frontend (decisión separada, ver §10)           |

El descarte de la cuenta personal es el punto no negociable: el costo de migrar
un namespace después de que existan imágenes de contenedor, _workflows_ con
`actions/checkout` cruzados, submódulos y documentación publicada es
desproporcionado frente a crear la organización hoy (costo ≈ 0).

## 5. Consecuencias

**Positivas**

- Namespace y propiedad definitivos desde el inicio; el upgrade a Team no altera
  URLs, IDs de repo, ni webhooks.
- Repos privados ilimitados con colaboradores ilimitados: no hay presión
  artificial para hacer público código que no debe serlo.
- Teams (grupos de permisos) ya disponibles: se puede modelar la estructura de
  acceso futura antes de que existan más usuarios.

**Negativas / limitaciones asumidas**

- Presupuesto de CI acotado (§6) para repos **privados**; los minutos de Actions
  son el recurso que primero se agota.
- Controles de seguridad avanzados (code scanning en privados, políticas
  org-wide estrictas, audit log extendido) no disponibles.
- Sin SSO/SAML ni _IP allow list_ — irrelevante hoy, bloqueante si entra un
  cliente con requisitos de cumplimiento.

**Neutras**

- Dependabot (alertas y _security updates_) y los _workflows_ básicos de CI
  funcionan en Free, por lo que la higiene de dependencias no queda bloqueada
  por el plan.

## 6. Limitaciones del plan Free — estado y confianza

> **Advertencia de vigencia:** GitHub modifica con frecuencia qué funciones
> bajan al tier Free (varias se liberaron entre 2023 y 2025). La tabla refleja
> el estado conocido; **las filas marcadas «Verificar» deben confirmarse contra
> la documentación oficial antes de diseñar un proceso encima de ellas**. No se
> debe asumir una limitación como permanente ni una función gratuita como
> garantizada.

| Capacidad                                                      | Estado en Free                                            | Confianza           | Impacto para Lobo Films                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| Repos públicos y privados ilimitados, colaboradores ilimitados | Disponible                                                | Alta                | Ninguno                                                                                             |
| GitHub Actions en repos **públicos** (runners estándar)        | Sin costo                                                 | Alta                | Ninguno                                                                                             |
| GitHub Actions en repos **privados**                           | ~2,000 min/mes + ~500 MB Packages                         | Alta (cifra, media) | **Restricción principal** — ver §8                                                                  |
| GitHub Pages desde repos **privados**                          | No disponible                                             | Media-alta          | Obliga a hosting externo (Vercel/Cloudflare/VPS) o repo público para sitios estáticos               |
| Branch protection / rulesets en repos privados                 | Históricamente de pago; ampliado a Free vía _rulesets_    | **Verificar**       | Determina si la protección de `main` es aplicable o solo convencional                               |
| `CODEOWNERS` con revisión obligatoria                          | Enforcement ligado a branch protection                    | **Verificar**       | Con un solo dev, el enforcement es cosmético; importa al sumar el segundo                           |
| Environments con _required reviewers_ / _wait timer_           | Solo públicos o planes de pago                            | Media-alta          | Los _approval gates_ de despliegue deben vivir en el proveedor de deploy, no en GitHub              |
| Code scanning / CodeQL en privados                             | Requiere GitHub Advanced Security                         | Alta                | Usar linters y SAST open source en el pipeline                                                      |
| Secret scanning + push protection                              | Gratis en públicos; ampliación a todos los repos en curso | **Verificar**       | Mientras no se confirme, la prevención de fugas depende de hooks locales (`gitleaks`, `trufflehog`) |
| Dependabot alerts / security updates                           | Disponible                                                | Alta                | Activar en todos los repos                                                                          |
| SAML SSO, IP allow list, audit log API                         | No disponible                                             | Alta                | Sin impacto hoy; bloqueante ante cliente enterprise                                                 |
| 2FA obligatorio para contribuidores                            | Exigido por GitHub                                        | Alta                | Requisito, no opción                                                                                |

**Regla derivada:** ningún proceso crítico de Lobo Films debe depender de una
función cuya disponibilidad en Free esté marcada «Verificar». Si se necesita, se
paga Team o se implementa fuera de GitHub.

## 7. Riesgo dominante: owner único (bus factor = 1)

Es el riesgo de mayor severidad de esta decisión, y es **independiente del
plan**: no se resuelve pagando Team.

| Escenario                              | Consecuencia                                    | Mitigación                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pérdida del segundo factor 2FA         | Bloqueo total de la organización                | Guardar **recovery codes** fuera del dispositivo (gestor de contraseñas + copia física/offline) y registrar un segundo método 2FA (passkey + TOTP en dispositivo distinto) |
| Cuenta suspendida o comprometida       | Pérdida de control del namespace y de los repos | Añadir un **segundo owner** (cuenta secundaria propia con correo y 2FA distintos) en cuanto exista; evitar un único correo de dominio no controlado                        |
| Correo de recuperación inaccesible     | Imposible recuperar la cuenta                   | Correo de la organización en dominio propio con acceso independiente                                                                                                       |
| Pérdida de artefactos/CI, no de código | Interrupción de despliegues                     | Mirror periódico (`git push --mirror`) a almacenamiento independiente; el código es distribuido, la configuración de la org **no**                                         |

Nota: lo que no es distribuido y por tanto no se recupera desde un clon local
son _issues_, PRs, releases, secrets y configuración de la organización. Si esa
información llega a tener valor operativo, agregar respaldo vía API.

## 8. Criterios de migración a GitHub Team (_triggers_ medibles)

La migración se evalúa cuando se cumpla **cualquiera** de estas condiciones; no
antes, y no por percepción:

1. **Consumo de Actions > ~1,600 min/mes** (80 % de la cuota) durante 2 meses
   consecutivos en repos privados.
2. **≥ 2 personas** con acceso de escritura regular, es decir, cuando la
   revisión de código deja de ser auto-revisión.
3. Necesidad real de **required reviewers en despliegues** o de branch
   protection con enforcement verificado (si la §6 confirma que Free no lo
   cubre).
4. Requisito contractual de un cliente que exija auditoría de accesos, SSO o
   retención de logs.
5. Necesidad de **GitHub Pages sobre repos privados** sin alternativa de hosting
   aceptable.

**Costo de referencia del upgrade:** ~4 USD/usuario/mes (verificar precio y
facturación vigentes). Con 2 usuarios ≈ 8 USD/mes ≈ **1,700–1,900 MXN/año** al
tipo de cambio actual. Es un umbral bajo: si un solo _trigger_ se cumple, la
decisión económica es trivial y no debe posponerse por ahorro.

**Costo técnico del upgrade:** nulo en términos de migración — cambio de plan,
sin transferencia de repos, sin cambio de URLs. Esto es precisamente lo que la
decisión de §3 protege.

Antes de pagar por minutos adicionales, evaluar en este orden: (1) cachés de
dependencias y `actions/cache`, (2) `paths-ignore` y _concurrency groups_ para
no ejecutar CI redundante, (3) matrices reducidas, (4) mover jobs pesados a un
runner propio en el VPS existente (_self-hosted runner_; no exponerlo a repos
públicos por riesgo de ejecución de código de terceros).

## 9. Convenciones operativas iniciales (aplicables desde hoy, costo cero)

- **Repo `.github` de la organización**: perfil público, plantillas de issue/PR,
  `SECURITY.md` y `CONTRIBUTING.md` heredados por todos los repos.
- **Nomenclatura**: `lobo-films/<dominio>-<tipo>` (p. ej. `web-app`,
  `catalog-api`, `infra-terraform`, `design-system`). `kebab-case`, sin
  abreviaturas ambiguas, sin el prefijo `lobo-` redundante dentro de la org.
- **Visibilidad por defecto**: privado. Público solo por decisión explícita (y
  considerando que públicos obtienen CI ilimitado y code scanning gratis — es un
  _trade-off_ real, no solo ideológico).
- **Ramas**: `main` protegida por convención (y por ruleset si §6 lo confirma),
  _trunk-based_ con ramas cortas; releases por tag semántico.
- **Secrets**: a nivel de repositorio mientras no haya _organization secrets_
  justificados; nunca en `.env` versionado; hook local de detección de secretos
  como compensación por el secret scanning no garantizado.
- **Permisos**: crear los teams (`@lobo-films/dev`, `@lobo-films/ops`) aunque
  hoy tengan un miembro; asignar permisos al team, nunca al usuario, para que el
  crecimiento no requiera reconfiguración.

## 10. Preguntas abiertas

- Estrategia mono-repo (Nx) vs. poly-repo para frontend + servicios: **decisión
  separada**, no implicada por este ADR. Afecta directamente el consumo de
  minutos de CI (un monorepo con _affected builds_ consume menos que N repos con
  pipelines duplicados).
- Registro de imágenes: GHCR (cuenta contra la cuota de Packages en Free) vs.
  registro del proveedor de hosting.
- Dominio del correo de la organización y su titularidad legal (relevante para
  recuperación de cuenta y para la eventual persona moral).

## 11. Revisión

Revisar este ADR en **marzo de 2027** o de inmediato ante cualquier _trigger_ de
la §8. Al revisarlo, re-verificar la tabla de la §6 contra la documentación
oficial vigente: su contenido tiene fecha de caducidad corta.
