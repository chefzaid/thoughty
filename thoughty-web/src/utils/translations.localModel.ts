import type { Language } from './translations';
import type { LocalModelProblem } from '../services/localModel/localModelClient';
import type { LocalModelAddressProblem } from '../services/localModel/localModelSettings';

export type LocalModelTranslationKey =
  | LocalModelProblem
  | LocalModelAddressProblem
  | 'localModelTitle'
  | 'localModelDescription'
  | 'localModelAddress'
  | 'localModelAddressHint'
  | 'localModelModel'
  | 'localModelApiKey'
  | 'localModelApiKeyHint'
  | 'localModelSave'
  | 'localModelTest'
  | 'localModelTesting'
  | 'localModelRemove'
  | 'localModelSaved'
  | 'localModelSaveFailed'
  | 'localModelRemoved'
  | 'localModelModelRequired'
  | 'localModelConnected'
  | 'localModelAvailableModels'
  | 'localModelOriginHint'
  | 'localModelAutoTagFailed'
  | 'aiChatKeptInBrowser';

/** The writer's own model server in Profile › AI Configuration, and what goes wrong when a diary set to it calls it. */
export const localModelTranslations: Record<Language, Record<LocalModelTranslationKey, string>> = {
  en: {
    localModelTitle: 'Your own model',
    localModelDescription:
      'For the diaries set to “My own model only” in Manage Diaries: the AI features (Rephrase, Auto Tag and tagging on save, Summarize, Discuss with AI, Get Inspired, the memoir’s follow-up questions; not transcription yet) go from this browser straight to a model server you run (Ollama, LM Studio, llama.cpp), never through Thoughty. These settings stay in this browser.',
    localModelAddress: 'Server address',
    localModelAddressHint: 'An OpenAI-compatible address: on this device, such as http://localhost:11434/v1 for Ollama or http://localhost:1234/v1 for LM Studio, or any https address, such as a server elsewhere on your network.',
    localModelModel: 'Model',
    localModelApiKey: 'API key (optional)',
    localModelApiKeyHint: 'Only if your server asks for one. It stays in this browser and is forgotten when you sign out.',
    localModelSave: 'Save model server',
    localModelTest: 'Test connection',
    localModelTesting: 'Testing…',
    localModelRemove: 'Remove',
    localModelSaved: 'Saved in this browser.',
    localModelSaveFailed: 'This browser could not keep these settings. Check that it lets this site store data.',
    localModelRemoved: 'Removed from this browser.',
    localModelModelRequired: 'Enter the name of the model to use.',
    localModelConnected: 'Connected: {model} is ready on your server.',
    localModelAvailableModels: 'Models on your server: {models}',
    localModelOriginHint: 'This site’s address to allow: {origin}',
    localModelAddressInvalid: 'Enter a web address starting with http:// or https://, such as http://localhost:11434/v1.',
    localModelAddressNeedsHttps:
      'Plain http only works for a server on this device (localhost or 127.0.0.1). A server elsewhere needs an https address with a certificate this browser trusts, or a port forwarded to this device (an SSH tunnel).',
    localModelNotConfigured: 'This diary uses only your own model. Set up its address in Profile › AI Configuration first.',
    localModelUnreachable:
      'Your model server could not be reached. Check that it is running at the address set in Profile › AI Configuration, that an https server has a certificate this browser trusts, and if your browser asks whether this site may reach apps on this device or your network, allow it.',
    localModelBlocked:
      'Your model server answered but does not allow this site. Allow this site’s address in it: for Ollama, set OLLAMA_ORIGINS to it and restart Ollama; in LM Studio, turn on CORS in the server settings.',
    localModelUnauthorized: 'Your model server refused the API key. Check the key in Profile › AI Configuration.',
    localModelModelNotFound: 'Your model server does not have this model. Check its name, or download it first (for Ollama: ollama pull and its name).',
    localModelNotOpenAi: 'No OpenAI-compatible API answered at this address. It usually ends in /v1, such as http://localhost:11434/v1.',
    localModelTimeout: 'Your model took too long to answer. Try again, or use a smaller model.',
    localModelUnreadable: 'Your model answered, but not in the form asked for. Try again, or use a larger model.',
    localModelFailed: 'Your model server could not answer. Try again.',
    localModelAutoTagFailed: 'The entry is saved, but your own model added no tags to it. Test the connection in Profile › AI Configuration to see why.',
    aiChatKeptInBrowser: 'This chat goes to your own model and is kept only in this browser, never on Thoughty’s server. It is deleted when you sign out.',
  },
  fr: {
    localModelTitle: 'Votre propre modèle',
    localModelDescription:
      "Pour les journaux réglés sur « Mon propre modèle uniquement » dans Gérer les journaux : les fonctions d'IA (Reformuler, Auto Tag et les tags à l'enregistrement, Résumer, Discuter avec l'IA, S'inspirer, les questions de relance des mémoires ; pas encore la transcription) vont directement de ce navigateur au serveur de modèle que vous faites tourner (Ollama, LM Studio, llama.cpp), sans jamais passer par Thoughty. Ces réglages restent dans ce navigateur.",
    localModelAddress: 'Adresse du serveur',
    localModelAddressHint: "Une adresse compatible OpenAI : sur cet appareil, comme http://localhost:11434/v1 pour Ollama ou http://localhost:1234/v1 pour LM Studio, ou n'importe quelle adresse https, comme un serveur ailleurs sur votre réseau.",
    localModelModel: 'Modèle',
    localModelApiKey: "Clé d'API (facultative)",
    localModelApiKeyHint: "Seulement si votre serveur en demande une. Elle reste dans ce navigateur et est oubliée à la déconnexion.",
    localModelSave: 'Enregistrer le serveur',
    localModelTest: 'Tester la connexion',
    localModelTesting: 'Test en cours…',
    localModelRemove: 'Retirer',
    localModelSaved: 'Enregistré dans ce navigateur.',
    localModelSaveFailed: "Ce navigateur n'a pas pu garder ces réglages. Vérifiez qu'il permet à ce site d'enregistrer des données.",
    localModelRemoved: 'Retiré de ce navigateur.',
    localModelModelRequired: 'Saisissez le nom du modèle à utiliser.',
    localModelConnected: 'Connecté : {model} est prêt sur votre serveur.',
    localModelAvailableModels: 'Modèles de votre serveur : {models}',
    localModelOriginHint: 'Adresse de ce site à autoriser : {origin}',
    localModelAddressInvalid: 'Saisissez une adresse web commençant par http:// ou https://, comme http://localhost:11434/v1.',
    localModelAddressNeedsHttps:
      "Le http simple ne fonctionne que pour un serveur sur cet appareil (localhost ou 127.0.0.1). Un serveur ailleurs demande une adresse https avec un certificat auquel ce navigateur fait confiance, ou un port redirigé vers cet appareil (un tunnel SSH).",
    localModelNotConfigured: "Ce journal n'utilise que votre propre modèle. Configurez d'abord son adresse dans Profil › Configuration IA.",
    localModelUnreachable:
      "Impossible de joindre votre serveur de modèle. Vérifiez qu'il tourne à l'adresse indiquée dans Profil › Configuration IA, qu'un serveur https a un certificat auquel ce navigateur fait confiance, et si votre navigateur demande si ce site peut accéder aux applications de cet appareil ou de votre réseau, autorisez-le.",
    localModelBlocked:
      "Votre serveur de modèle a répondu mais n'autorise pas ce site. Autorisez-y l'adresse de ce site : pour Ollama, mettez-la dans OLLAMA_ORIGINS puis redémarrez Ollama ; dans LM Studio, activez CORS dans les réglages du serveur.",
    localModelUnauthorized: "Votre serveur de modèle a refusé la clé d'API. Vérifiez-la dans Profil › Configuration IA.",
    localModelModelNotFound: "Votre serveur de modèle n'a pas ce modèle. Vérifiez son nom, ou téléchargez-le d'abord (pour Ollama : ollama pull suivi de son nom).",
    localModelNotOpenAi: "Aucune API compatible OpenAI n'a répondu à cette adresse. Elle se termine en général par /v1, comme http://localhost:11434/v1.",
    localModelTimeout: 'Votre modèle a mis trop de temps à répondre. Réessayez, ou utilisez un modèle plus petit.',
    localModelUnreadable: "Votre modèle a répondu, mais pas sous la forme demandée. Réessayez, ou utilisez un modèle plus grand.",
    localModelFailed: "Votre serveur de modèle n'a pas pu répondre. Réessayez.",
    localModelAutoTagFailed: "L'entrée est enregistrée, mais votre propre modèle n'y a ajouté aucun tag. Testez la connexion dans Profil › Configuration IA pour savoir pourquoi.",
    aiChatKeptInBrowser: "Cette discussion va à votre propre modèle et n'est gardée que dans ce navigateur, jamais sur le serveur de Thoughty. Elle est effacée à la déconnexion.",
  },
};
