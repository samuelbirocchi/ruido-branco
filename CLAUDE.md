# CLAUDE.md

Skill Alexa de ruído branco em loop infinito (ver `README.md`). Duas regras que quebram o loop em silêncio:

- O áudio fica no **GitHub Pages** deste repo, não no S3 da skill Alexa-hosted: a URL pré-assinada do S3 expira em 60 s.
- No `Play` com `ENQUEUE`, `expectedPreviousToken` é o token do stream que está tocando e o token do novo stream é diferente do atual. `REPLACE_ALL` não leva `expectedPreviousToken`. Os testes em `lambda/test/skill.test.js` cobrem as três regras.

## Comandos

```bash
cd lambda && npm install && npm test
```
