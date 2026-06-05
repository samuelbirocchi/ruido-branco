/**
 * Som de Dormir — skill Alexa que toca ruído branco em loop infinito
 * até o usuário mandar parar ("Alexa, para").
 *
 * Mecânica do loop (ver README):
 *  - Launch/Tocar  → Play REPLACE_ALL (token novo, sessão encerra, áudio continua)
 *  - PlaybackNearlyFinished → Play ENQUEUE da MESMA URL com:
 *      • token novo (diferente do atual, senão o device ignora)
 *      • expectedPreviousToken = token do stream em reprodução (obrigatório
 *        com ENQUEUE; se não bater, o device descarta a diretiva e o loop morre)
 */
const Alexa = require('ask-sdk-core');

const AUDIO_URL =
  'https://samuelbirocchi.github.io/ruido-branco/audio/ruido-branco-60min.mp3';
const TOKEN_PREFIX = 'ruido-branco-';

const newToken = (previous) => {
  const n = parseInt(String(previous || '').slice(TOKEN_PREFIX.length), 10);
  return TOKEN_PREFIX + (Number.isFinite(n) ? n + 1 : 0);
};

/** Começa a tocar do zero, substituindo qualquer fila anterior. */
const startPlayback = (handlerInput) =>
  handlerInput.responseBuilder
    .addAudioPlayerPlayDirective('REPLACE_ALL', AUDIO_URL, newToken(null), 0)
    .withShouldEndSession(true)
    .getResponse();

const PlayHandler = {
  canHandle(handlerInput) {
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (type === 'LaunchRequest') return true;
    if (type !== 'IntentRequest') return false;
    const intent = Alexa.getIntentName(handlerInput.requestEnvelope);
    return intent === 'TocarIntent' || intent === 'AMAZON.ResumeIntent';
  },
  handle: startPlayback,
};

/** Coração do loop: re-enfileira a mesma URL a cada ciclo, para sempre. */
const PlaybackNearlyFinishedHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      'AudioPlayer.PlaybackNearlyFinished'
    );
  },
  handle(handlerInput) {
    // Eventos AudioPlayer chegam sem sessão: o token vem do envelope.
    const currentToken = handlerInput.requestEnvelope.request.token;
    return handlerInput.responseBuilder
      .addAudioPlayerPlayDirective(
        'ENQUEUE',
        AUDIO_URL,
        newToken(currentToken),
        0,
        currentToken
      )
      .getResponse();
  },
};

const StopHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      [
        'AMAZON.StopIntent',
        'AMAZON.CancelIntent',
        'AMAZON.PauseIntent',
      ].includes(Alexa.getIntentName(handlerInput.requestEnvelope))
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .withShouldEndSession(true)
      .getResponse();
  },
};

/**
 * Botões físicos / da tela. Requests sem sessão: a resposta não pode conter
 * outputSpeech/card/reprompt — só diretivas AudioPlayer.
 * Next/Previous não fazem sentido com um som só → no-op silencioso.
 */
const PlaybackControllerHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope).startsWith(
      'PlaybackController.'
    );
  },
  handle(handlerInput) {
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (type === 'PlaybackController.PlayCommandIssued') {
      return handlerInput.responseBuilder
        .addAudioPlayerPlayDirective('REPLACE_ALL', AUDIO_URL, newToken(null), 0)
        .getResponse();
    }
    if (type === 'PlaybackController.PauseCommandIssued') {
      return handlerInput.responseBuilder
        .addAudioPlayerStopDirective()
        .getResponse();
    }
    return handlerInput.responseBuilder.getResponse(); // Next/Previous: no-op
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        'Eu toco ruído branco sem parar até você dizer: Alexa, para. Quer começar?'
      )
      .reprompt('É só dizer: tocar.')
      .getResponse();
  },
};

// Decisão deliberada: qualquer fala não entendida → toca. É uma skill de
// dormir com uma função só; errar tocando é melhor que errar falando.
const FallbackHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent'
    );
  },
  handle: startPlayback,
};

// NavigateHome: encerra sem falar nada e sem mexer na reprodução.
const NavigateHomeHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        'AMAZON.NavigateHomeIntent'
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.withShouldEndSession(true).getResponse();
  },
};

// Alexa envia isto quando rejeita uma diretiva nossa. Sem sessão: só logar.
const ExceptionEncounteredHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      'System.ExceptionEncountered'
    );
  },
  handle(handlerInput) {
    console.error(
      'System.ExceptionEncountered:',
      JSON.stringify(handlerInput.requestEnvelope.request.error)
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * Eventos de ciclo de vida que só precisam de resposta vazia.
 * PlaybackFailed: apenas loga — reemitir Play aqui poderia criar um
 * loop infinito de falhas se a URL estiver fora do ar.
 */
const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope).startsWith(
      'AudioPlayer.'
    );
  },
  handle(handlerInput) {
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    if (type === 'AudioPlayer.PlaybackFailed') {
      console.error(
        'PlaybackFailed:',
        JSON.stringify(handlerInput.requestEnvelope.request.error)
      );
    }
    return handlerInput.responseBuilder.getResponse();
  },
};

const SessionEndedHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest'
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle: () => true,
  handle(handlerInput, error) {
    console.error('Erro não tratado:', error);
    // Requests fora de sessão (AudioPlayer.*, PlaybackController.*, System.*)
    // não aceitam outputSpeech — falar aqui seria rejeitado pelo device.
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    const inSession = type === 'IntentRequest' || type === 'LaunchRequest';
    if (!inSession) {
      return handlerInput.responseBuilder.getResponse();
    }
    return handlerInput.responseBuilder
      .speak('Desculpe, algo deu errado. Tente de novo.')
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    PlayHandler,
    PlaybackNearlyFinishedHandler, // antes do catch-all AudioPlayer
    StopHandler,
    PlaybackControllerHandler,
    HelpHandler,
    FallbackHandler,
    NavigateHomeHandler,
    ExceptionEncounteredHandler,
    AudioPlayerEventHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
