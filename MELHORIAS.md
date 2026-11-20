# Melhorias 2026-11-20
## 1. Servidor caía com URL malformada
- RESUMO: ids inválidos viram 400
- IMPACTO: 5
- TESTES: passam
- COMMIT: cec942d
- POR QUE: um `%` malformado em /api/saved ou /api/applications derrubava o processo inteiro (qualquer visitante podia tirar o site do ar).
- EVIDENCIA: `curl -XPOST localhost:18099/api/saved/%E0%A4%A` — antes: servidor morria (Node crash); depois: 400 e /health continua 200. `npm test`: 48 passam, 0 falham.
## 2. XP com valor inválido corrompia o perfil
- RESUMO: valida amount do XP
- IMPACTO: 3
- TESTES: passam
- COMMIT: 75f1d65
- POR QUE: amount em texto era concatenado ao XP e valores enormes eram aceitos, quebrando nível e perfil.
- EVIDENCIA: `npm test`: 49 passam, 0 falham (novo teste cobre string, NaN, negativo e 1e12).
