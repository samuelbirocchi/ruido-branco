# Som de Dormir — ruído branco infinito para Alexa

Skill Alexa **100% gratuita** que toca ruído branco em loop contínuo até você dizer
**"Alexa, para"**. Sem limite de 1 hora, sem assinatura, sem anúncios — os limites que as
skills famosas (Sleep Jar, Sleep Sounds, TMSOFT White Noise) cobram para remover são
artificiais; a plataforma não impõe nenhum.

## Como funciona

- **Backend**: skill *Alexa-hosted* (Lambda gratuito da Amazon, sem cartão de crédito,
  sem expiração — a cota é mensal e recorrente).
- **Áudio**: MP3 de 60 min servido pelo **GitHub Pages** deste repositório
  (HTTPS permanente, custo zero). O bucket S3 da skill Alexa-hosted **não serve**:
  a URL pré-assinada expira em 60 s e quebraria o re-enfileiramento do loop.
- **Loop**: o AudioPlayer da Alexa não tem repeat nativo. A cada
  `AudioPlayer.PlaybackNearlyFinished` a skill responde com `Play`/`ENQUEUE` da mesma
  URL. Regras críticas (é aqui que loops de outras skills morrem em silêncio):
  - `expectedPreviousToken` **deve** ser igual ao token do stream tocando agora,
    senão o device descarta a diretiva;
  - o token do novo stream **deve** ser diferente do atual (a skill incrementa
    `ruido-branco-0`, `-1`, `-2`…);
  - `REPLACE_ALL` (usado no início) **não pode** carregar `expectedPreviousToken`.
- O arquivo tem 60 min, então a emenda do loop acontece só 1x/hora — e em ruído
  branco o corte é praticamente inaudível.
- A reprodução continua depois que a sessão da skill encerra, indefinidamente,
  até "Alexa, para" (ou outro app de áudio assumir o device).
- **Custo total: R$ 0.** Skill em estágio *Development* funciona para sempre nos
  Echos da mesma conta Amazon — não precisa de certificação nem publicação
  (o limite de 90 dias é só para beta test com testers externos).

## Estrutura

```
audio/ruido-branco-60min.mp3                  ← servido via GitHub Pages
lambda/index.js                               ← código da skill (ask-sdk-core)
lambda/test/skill.test.js                     ← testes (node --test)
skill-package/interactionModels/custom/pt-BR.json
skill-package/skill.json                      ← manifest (referência)
scripts/generate-audio.sh                     ← regenera o MP3 (ffmpeg)
```

## Hospedar o áudio (se você forkou este repo)

A URL em `lambda/index.js` (`AUDIO_URL`) aponta para o GitHub Pages **deste** repo.
Se você forkou: *Settings* → *Pages* → *Source*: branch `main`, pasta `/ (root)` →
*Save*. Em ~1 min o MP3 fica em
`https://<seu-usuario>.github.io/<repo>/audio/ruido-branco-60min.mp3` —
atualize a constante `AUDIO_URL` no `lambda/index.js` antes do deploy.

## Deploy (console web, ~10 min, sem CLI)

1. **Conta**: crie/use uma conta em [developer.amazon.com](https://developer.amazon.com)
   com **o mesmo e-mail da conta Amazon dos seus Echos**. É grátis.
2. **Criar skill**: [console Alexa](https://developer.amazon.com/alexa/console/ask) →
   *Create Skill* → nome `Som de Dormir` → locale **Portuguese (BR)** → tipo
   **Custom** → hosting **Alexa-hosted (Node.js)** → template *Start from scratch*.
3. **Interaction model**: aba *Build* → *Interaction Model* → *JSON Editor* → cole o
   conteúdo de [`skill-package/interactionModels/custom/pt-BR.json`](skill-package/interactionModels/custom/pt-BR.json)
   → *Save Model* → *Build Model*.
4. **Interface AudioPlayer**: aba *Build* → *Interfaces* → ligue **Audio Player** → *Save*.
   (Sem isso as diretivas Play são rejeitadas.)
5. **Código**: aba *Code* → substitua o conteúdo de `index.js` pelo
   [`lambda/index.js`](lambda/index.js) deste repo → *Save* → **Deploy**.
   (O `package.json` do template já traz `ask-sdk-core`; não precisa mexer.)
6. **Testar**: aba *Test* → habilite *Development*. No simulador digite
   `abrir som de dormir` (o simulador nem sempre toca áudio — confie no device real).
7. **No Echo**: "Alexa, abrir som de dormir". Para parar: "Alexa, para".
   **Deixe tocando 2h+ uma vez** para confirmar que o loop re-enfileira todo ciclo.

## Comandos de voz

| Comando | Efeito |
|---|---|
| "Alexa, abrir som de dormir" | começa a tocar imediatamente |
| "Alexa, para" / "cancela" / "pausa" | para |
| "Alexa, continua" | retoma (recomeça do zero — em ruído branco dá no mesmo) |
| "Alexa, para em 2 horas" | timer de sono nativo da Alexa (grátis, não é da skill) |

## Regenerar / trocar o som

```bash
./scripts/generate-audio.sh   # requer ffmpeg
```

Para ruído rosa (mais grave, tipo chuva): troque `c=white` por `c=pink` e remova o
filtro `-af`. Commit + push: o GitHub Pages atualiza a URL sozinho em ~1 min.

## Testes

```bash
cd lambda && npm install && npm test
```
