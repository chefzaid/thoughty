import { useId, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { testLocalModel } from "../../services/localModel/localModelClient";
import { testLocalTranscription } from "../../services/localModel/localModelTranscription";
import {
  parseLocalModelAddress,
  readLocalModelSettings,
  removeLocalModelSettings,
  writeLocalModelSettings,
  type LocalModelSettings,
} from "../../services/localModel/localModelSettings";
import type { TranslationFunction } from "./types";
import "./AiCredentialPanel.css";
import "./LocalModelPanel.css";

interface LocalModelPanelProps {
  readonly theme: "light" | "dark";
  readonly t: TranslationFunction;
}

interface PanelMessage {
  readonly kind: "error" | "success";
  readonly lines: readonly string[];
}

/**
 * The writer's own model server, for the diaries set to "My own model only": its address, model, optional key and
 * optional speech-to-text model, kept in this browser, and a test that calls it the way those diaries' AI actions
 * will (transcription too, once a speech-to-text model is set).
 */
function LocalModelPanel({ theme, t }: Readonly<LocalModelPanelProps>) {
  const userId = useAuth().user?.id ?? null;
  const [stored] = useState(() => readLocalModelSettings(userId));
  const [baseUrl, setBaseUrl] = useState(stored?.baseUrl ?? "");
  const [model, setModel] = useState(stored?.model ?? "");
  const [apiKey, setApiKey] = useState(stored?.apiKey ?? "");
  const [transcriptionModel, setTranscriptionModel] = useState(stored?.transcriptionModel ?? "");
  const [saved, setSaved] = useState(stored !== null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<PanelMessage | null>(null);
  const id = useId();
  const inputClass = `setting-input ${theme}`;

  const error = (...lines: string[]) => setMessage({ kind: "error", lines });

  /** The settings in the fields, or null once the message says what is wrong with them. */
  const readFields = (): LocalModelSettings | null => {
    const address = parseLocalModelAddress(baseUrl);
    if (address.baseUrl === null) {
      error(t(address.problem));
      return null;
    }
    if (!model.trim()) {
      error(t("localModelModelRequired"));
      return null;
    }
    return { baseUrl: address.baseUrl, model: model.trim(), apiKey: apiKey.trim(), transcriptionModel: transcriptionModel.trim() };
  };

  const save = () => {
    const settings = readFields();
    if (!settings || userId === null) return;
    if (!writeLocalModelSettings(userId, settings)) {
      error(t("localModelSaveFailed"));
      return;
    }
    setBaseUrl(settings.baseUrl);
    setSaved(true);
    setMessage({ kind: "success", lines: [t("localModelSaved")] });
  };

  /** What the test says of the chat model: connected, or why not (with the origin to allow and the models listed). */
  const testChat = async (settings: LocalModelSettings): Promise<PanelMessage> => {
    const result = await testLocalModel(settings);
    if (result.problem === null) return { kind: "success", lines: [t("localModelConnected", { model: settings.model })] };
    return {
      kind: "error",
      lines: [
        t(result.problem),
        ...(result.problem === "localModelBlocked" ? [t("localModelOriginHint", { origin: globalThis.location.origin })] : []),
        ...(result.models.length > 0 ? [t("localModelAvailableModels", { models: result.models.join(", ") })] : []),
      ],
    };
  };

  const test = async () => {
    const settings = readFields();
    if (!settings) return;
    setTesting(true);
    setMessage(null);
    const chat = await testChat(settings);
    // The speech-to-text endpoint is tested only once the writer names a model for it
    const speech = settings.transcriptionModel ? await testLocalTranscription(settings) : null;
    setTesting(false);
    const speechLines = speech ? [speech.problem === null ? t("localModelTranscriptionReady", { model: settings.transcriptionModel }) : t(speech.problem)] : [];
    const failed = chat.kind === "error" || (speech !== null && speech.problem !== null);
    setMessage({ kind: failed ? "error" : "success", lines: [...chat.lines, ...speechLines] });
  };

  const remove = () => {
    if (userId !== null) removeLocalModelSettings(userId);
    setBaseUrl("");
    setModel("");
    setApiKey("");
    setTranscriptionModel("");
    setSaved(false);
    setMessage({ kind: "success", lines: [t("localModelRemoved")] });
  };

  return (
    <section className="local-model-panel" aria-labelledby={`${id}-title`}>
      <div>
        <h3 id={`${id}-title`} className="ai-credential-title">{t("localModelTitle")}</h3>
        <p className="local-model-description">{t("localModelDescription")}</p>
      </div>
      <div className="local-model-fields">
        <div className="local-model-field">
          <label className="setting-label" htmlFor={`${id}-address`}>{t("localModelAddress")}</label>
          <input
            id={`${id}-address`}
            type="url"
            className={inputClass}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://localhost:11434/v1"
            aria-describedby={`${id}-address-hint`}
            autoComplete="off"
            spellCheck={false}
          />
          <span id={`${id}-address-hint`} className="local-model-hint">{t("localModelAddressHint")}</span>
        </div>
        <div className="local-model-field">
          <label className="setting-label" htmlFor={`${id}-model`}>{t("localModelModel")}</label>
          <input
            id={`${id}-model`}
            type="text"
            className={inputClass}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="llama3.2"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="local-model-field">
          <label className="setting-label" htmlFor={`${id}-key`}>{t("localModelApiKey")}</label>
          <input
            id={`${id}-key`}
            type="password"
            className={inputClass}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            aria-describedby={`${id}-key-hint`}
            autoComplete="off"
            spellCheck={false}
          />
          <span id={`${id}-key-hint`} className="local-model-hint">{t("localModelApiKeyHint")}</span>
        </div>
        <div className="local-model-field">
          <label className="setting-label" htmlFor={`${id}-speech`}>{t("localModelTranscriptionModel")}</label>
          <input
            id={`${id}-speech`}
            type="text"
            className={inputClass}
            value={transcriptionModel}
            onChange={(event) => setTranscriptionModel(event.target.value)}
            placeholder="whisper-1"
            aria-describedby={`${id}-speech-hint`}
            autoComplete="off"
            spellCheck={false}
          />
          <span id={`${id}-speech-hint`} className="local-model-hint">{t("localModelTranscriptionModelHint")}</span>
        </div>
      </div>
      <div className="local-model-actions">
        <button type="button" className="profile-primary-action" onClick={save} disabled={testing}>
          <span className="codicon codicon-save" aria-hidden="true" />
          {t("localModelSave")}
        </button>
        <button type="button" className="local-model-secondary" onClick={() => void test()} disabled={testing}>
          <span className={`codicon codicon-${testing ? "loading codicon-modifier-spin" : "plug"}`} aria-hidden="true" />
          {testing ? t("localModelTesting") : t("localModelTest")}
        </button>
        {saved && (
          <button type="button" className="profile-danger-action" onClick={remove} disabled={testing}>
            <span className="codicon codicon-trash" aria-hidden="true" />
            {t("localModelRemove")}
          </button>
        )}
      </div>
      {message && (
        <output className={`ai-credential-message ${message.kind}`}>
          {message.lines.map((line) => <span key={line} className="local-model-message-line">{line}</span>)}
        </output>
      )}
    </section>
  );
}

export default LocalModelPanel;
