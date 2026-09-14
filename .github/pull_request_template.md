# {type}(LDS-XXXX): {título en imperativo}

## Summary

<!-- 1–3 líneas: qué resuelve este PR y por qué. Sin detalle de implementación. -->

## Jira URL

<!-- Se completa automáticamente a partir del nombre de la rama (workflow jira-url.yml) -->

## Description

<!-- Qué se hizo y cómo. Decisiones técnicas relevantes, trade-offs, alternativas descartadas.
     Enlace al ticket de Jira: https://hipstha.atlassian.net/browse/LDS-XXXX -->

## Type of change

- [ ] feature
- [ ] bugfix
- [ ] hotfix
- [ ] docs
- [ ] poc

## Validation Steps

<!-- Pasos numerados y reproducibles para que el revisor verifique el cambio en local.
     Incluir comandos exactos, ruta del story en Storybook y resultado esperado. -->

1.
2.
3.

## Evidence

<!-- Capturas o video del componente/token en Storybook, antes y después cuando aplique.
     Obligatorio en todo PR con impacto visual. -->

## Impact

- **Tokens o variables modificados:**
  <!-- lista `--nombre: valor` o "Ninguno" -->
- **Breaking change:** Sí / No <!-- si es Sí, describir migración -->
- **Riesgo y rollback:** <!-- qué puede romperse y cómo revertir -->

## Checks

- [ ] `npm run typecheck` en verde
- [ ] `npm run oxlint` en verde
- [ ] `npm run prettier` en verde
- [ ] `npm run test` en verde
- [ ] `npm run build` en verde
- [ ] Storybook levanta sin errores de consola
- [ ] Valores implementados verificados contra `Design System v2.0 Lobo` (sin
      valores inventados)
- [ ] Accesibilidad revisada: contraste, foco visible, semántica
- [ ] Documentación actualizada (`README.md` / docs del story) cuando aplica
- [ ] Rama sigue el patrón `type/LDS-XXXX` y se eliminará al hacer merge
