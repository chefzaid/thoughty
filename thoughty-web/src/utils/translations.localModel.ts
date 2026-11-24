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
  | 'localModelOriginHint';

/** The writer's own model server in Profile › AI Configuration, and what goes wrong when a diary set to it calls it. */
export const localModelTranslations: Record<Language, Record<LocalModelTranslationKey, string>> = {
  en: {
    localModelTitle: 'Your own model',
    localModelDescription:
      'For the diaries set to “My own model only” in Manage Diaries: Rephrase, Auto Tag and Summarize go from this browser straight to a model server you run on this device (Ollama, LM Studio, llama.cpp), never through Thoughty. These settings stay in this browser.',
    localModelAddress: 'Server address',
    localModelAddressHint: 'An OpenAI-compatible address on this device, such as http://localhost:11434/v1 for Ollama or http://localhost:1234/v1 for LM Studio.',
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
    localModelAddressNotLocal:
      'Only a server on this device can be used (localhost or 127.0.0.1). To use one elsewhere on your network, forward its port to this device, for example with an SSH tunnel.',
    localModelNotConfigured: 'This diary uses only your own model. Set up its address in Profile › AI Configuration first.',
    localModelUnreachable:
      'Your model server could not be reached. Check that it is running on this device at the address set in Profile › AI Configuration, and if your browser asks whether this site may reach apps on this device, allow it.',
    localModelBlocked:
      'Your model server answered but does not allow this site. Allow this site’s address in it: for Ollama, set OLLAMA_ORIGINS to it and restart Ollama; in LM Studio, turn on CORS in the server settings.',
    localModelUnauthorized: 'Your model server refused the API key. Check the key in Profile › AI Configuration.',
    localModelModelNotFound: 'Your model server does not have this model. Check its name, or download it first (for Ollama: ollama pull and its name).',
    localModelNotOpenAi: 'No OpenAI-compatible API answered at this address. It usually ends in /v1, such as http://localhost:11434/v1.',
    localModelTimeout: 'Your model took too long to answer. Try again, or use a smaller model.',
    localModelFailed: 'Your model server could not answer. Try again.',
  },
  fr: {
    localModelTitle: 'Votre propre modèle',
    localModelDescription:
      "Pour les journaux réglés sur « Mon propre modèle uniquement » dans Gérer les journaux : Reformuler, Auto Tag et Résumer vont directement de ce navigateur au serveur de modèle que vous faites tourner sur cet appareil (Ollama, LM Studio, llama.cpp), sans jamais passer par Thoughty. Ces réglages restent dans ce navigateur.",
    localModelAddress: 'Adresse du serveur',
    localModelAddressHint: "Une adresse compatible OpenAI sur cet appareil, comme http://localhost:11434/v1 pour Ollama ou http://localhost:1234/v1 pour LM Studio.",
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
    localModelAddressNotLocal:
      "Seul un serveur sur cet appareil peut être utilisé (localhost ou 127.0.0.1). Pour en utiliser un ailleurs sur votre réseau, redirigez son port vers cet appareil, par exemple avec un tunnel SSH.",
    localModelNotConfigured: "Ce journal n'utilise que votre propre modèle. Configurez d'abord son adresse dans Profil › Configuration IA.",
    localModelUnreachable:
      "Impossible de joindre votre serveur de modèle. Vérifiez qu'il tourne sur cet appareil à l'adresse indiquée dans Profil › Configuration IA, et si votre navigateur demande si ce site peut accéder aux applications de cet appareil, autorisez-le.",
    localModelBlocked:
      "Votre serveur de modèle a répondu mais n'autorise pas ce site. Autorisez-y l'adresse de ce site : pour Ollama, mettez-la dans OLLAMA_ORIGINS puis redémarrez Ollama ; dans LM Studio, activez CORS dans les réglages du serveur.",
    localModelUnauthorized: "Votre serveur de modèle a refusé la clé d'API. Vérifiez-la dans Profil › Configuration IA.",
    localModelModelNotFound: "Votre serveur de modèle n'a pas ce modèle. Vérifiez son nom, ou téléchargez-le d'abord (pour Ollama : ollama pull suivi de son nom).",
    localModelNotOpenAi: "Aucune API compatible OpenAI n'a répondu à cette adresse. Elle se termine en général par /v1, comme http://localhost:11434/v1.",
    localModelTimeout: 'Votre modèle a mis trop de temps à répondre. Réessayez, ou utilisez un modèle plus petit.',
    localModelFailed: "Votre serveur de modèle n'a pas pu répondre. Réessayez.",
  },
};
