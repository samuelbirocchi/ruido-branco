const { test } = require('node:test');
const assert = require('node:assert');
const { handler } = require('../index.js');

const AUDIO_URL =
  'https://samuelbirocchi.github.io/ruido-branco/audio/ruido-branco-60min.mp3';

const baseContext = {
  System: {
    application: { applicationId: 'amzn1.ask.skill.test' },
    user: { userId: 'amzn1.ask.account.test' },
    device: {
      deviceId: 'test-device',
      supportedInterfaces: { AudioPlayer: {} },
    },
  },
};

const envelope = (request, withSession = false) => ({
  version: '1.0',
  ...(withSession && {
    session: {
      new: true,
      sessionId: 'amzn1.echo-api.session.test',
      application: baseContext.System.application,
      user: baseContext.System.user,
    },
  }),
  context: baseContext,
  request: {
    requestId: 'amzn1.echo-api.request.test',
    timestamp: '2026-06-05T00:00:00Z',
    locale: 'pt-BR',
    ...request,
  },
});

const invoke = (env) =>
  new Promise((resolve, reject) =>
    handler(env, {}, (err, res) => (err ? reject(err) : resolve(res)))
  );

const intent = (name) => ({ type: 'IntentRequest', intent: { name } });

test('LaunchRequest começa a tocar com REPLACE_ALL e encerra a sessão', async () => {
  const res = await invoke(envelope({ type: 'LaunchRequest' }, true));
  const [directive] = res.response.directives;
  assert.equal(directive.type, 'AudioPlayer.Play');
  assert.equal(directive.playBehavior, 'REPLACE_ALL');
  assert.equal(directive.audioItem.stream.url, AUDIO_URL);
  assert.equal(directive.audioItem.stream.token, 'ruido-branco-0');
  assert.equal(directive.audioItem.stream.offsetInMilliseconds, 0);
  assert.equal(res.response.shouldEndSession, true);
  // REPLACE_ALL não pode carregar expectedPreviousToken (vira erro no device)
  assert.equal(directive.audioItem.stream.expectedPreviousToken, undefined);
});

test('PlaybackNearlyFinished re-enfileira a mesma URL com tokens corretos', async () => {
  const res = await invoke(
    envelope({ type: 'AudioPlayer.PlaybackNearlyFinished', token: 'ruido-branco-4' })
  );
  const [directive] = res.response.directives;
  assert.equal(directive.type, 'AudioPlayer.Play');
  assert.equal(directive.playBehavior, 'ENQUEUE');
  assert.equal(directive.audioItem.stream.url, AUDIO_URL);
  // expectedPreviousToken DEVE bater com o stream atual, senão o device ignora
  assert.equal(directive.audioItem.stream.expectedPreviousToken, 'ruido-branco-4');
  // token novo DEVE ser diferente do atual
  assert.equal(directive.audioItem.stream.token, 'ruido-branco-5');
});

test('PlaybackNearlyFinished com token inesperado ainda fecha o loop', async () => {
  const res = await invoke(
    envelope({ type: 'AudioPlayer.PlaybackNearlyFinished', token: 'algo-estranho' })
  );
  const [directive] = res.response.directives;
  assert.equal(directive.audioItem.stream.expectedPreviousToken, 'algo-estranho');
  assert.equal(directive.audioItem.stream.token, 'ruido-branco-0');
  assert.notEqual(directive.audioItem.stream.token, 'algo-estranho');
});

for (const name of ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.PauseIntent']) {
  test(`${name} para a reprodução`, async () => {
    const res = await invoke(envelope(intent(name), true));
    assert.equal(res.response.directives[0].type, 'AudioPlayer.Stop');
  });
}

test('AMAZON.ResumeIntent retoma com REPLACE_ALL', async () => {
  const res = await invoke(envelope(intent('AMAZON.ResumeIntent'), true));
  const [directive] = res.response.directives;
  assert.equal(directive.playBehavior, 'REPLACE_ALL');
});

test('TocarIntent toca', async () => {
  const res = await invoke(envelope(intent('TocarIntent'), true));
  assert.equal(res.response.directives[0].type, 'AudioPlayer.Play');
});

test('botão de pause (PlaybackController) para sem propriedades de sessão', async () => {
  const res = await invoke(
    envelope({ type: 'PlaybackController.PauseCommandIssued' })
  );
  assert.equal(res.response.directives[0].type, 'AudioPlayer.Stop');
  // request sem sessão: resposta não pode ter speech nem shouldEndSession
  assert.equal(res.response.outputSpeech, undefined);
  assert.equal(res.response.shouldEndSession, undefined);
});

test('botão de play (PlaybackController) toca', async () => {
  const res = await invoke(
    envelope({ type: 'PlaybackController.PlayCommandIssued' })
  );
  assert.equal(res.response.directives[0].playBehavior, 'REPLACE_ALL');
  assert.equal(res.response.outputSpeech, undefined);
});

for (const type of [
  'PlaybackController.NextCommandIssued',
  'PlaybackController.PreviousCommandIssued',
]) {
  test(`${type} é no-op silencioso (não fala erro por cima do ruído)`, async () => {
    const res = await invoke(envelope({ type }));
    assert.equal(res.response.directives, undefined);
    assert.equal(res.response.outputSpeech, undefined);
  });
}

test('System.ExceptionEncountered só loga, sem speech', async () => {
  const res = await invoke(
    envelope({
      type: 'System.ExceptionEncountered',
      error: { type: 'INVALID_RESPONSE', message: 'directive rejected' },
      cause: { requestId: 'amzn1.echo-api.request.prev' },
    })
  );
  assert.equal(res.response.directives, undefined);
  assert.equal(res.response.outputSpeech, undefined);
});

test('AMAZON.NavigateHomeIntent encerra sem falar e sem parar o áudio', async () => {
  const res = await invoke(envelope(intent('AMAZON.NavigateHomeIntent'), true));
  assert.equal(res.response.directives, undefined);
  assert.equal(res.response.outputSpeech, undefined);
  assert.equal(res.response.shouldEndSession, true);
});

test('ErrorHandler não fala em request fora de sessão', async () => {
  // tipo desconhecido sem sessão → cai no ErrorHandler → resposta vazia
  const res = await invoke(envelope({ type: 'GameEngine.InputHandlerEvent' }));
  assert.equal(res.response.outputSpeech, undefined);
});

test('ErrorHandler fala em request com sessão', async () => {
  // intent não declarado em nenhum handler → ErrorHandler com speech
  const res = await invoke(envelope(intent('IntentInexistente'), true));
  assert.ok(res.response.outputSpeech);
});

for (const type of [
  'AudioPlayer.PlaybackStarted',
  'AudioPlayer.PlaybackFinished',
  'AudioPlayer.PlaybackStopped',
]) {
  test(`${type} retorna resposta vazia`, async () => {
    const res = await invoke(envelope({ type, token: 'ruido-branco-1' }));
    assert.equal(res.response.directives, undefined);
    assert.equal(res.response.outputSpeech, undefined);
  });
}

test('PlaybackFailed não reemite Play (evita loop de falhas)', async () => {
  const res = await invoke(
    envelope({
      type: 'AudioPlayer.PlaybackFailed',
      token: 'ruido-branco-1',
      error: { type: 'MEDIA_ERROR_UNKNOWN', message: 'boom' },
    })
  );
  assert.equal(res.response.directives, undefined);
});

test('FallbackIntent toca em vez de falar (skill de dormir)', async () => {
  const res = await invoke(envelope(intent('AMAZON.FallbackIntent'), true));
  assert.equal(res.response.directives[0].type, 'AudioPlayer.Play');
});
