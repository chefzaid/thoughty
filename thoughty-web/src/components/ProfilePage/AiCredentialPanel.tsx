import { useCallback, useEffect, useState } from "react";
import type {
  OpenRouterCredentialStatus,
  OpenRouterUsageDashboard,
} from "../../services/api";
import { useApiServices } from "../../hooks/useAppState";
import type { TranslationFunction } from "./types";
import "./AiCredentialPanel.css";

interface AiCredentialPanelProps {
  t: TranslationFunction;
  onCredentialChanged: () => Promise<void>;
}

const formatNumber = (value: number): string =>
  new Intl.NumberFormat().format(value);
const formatCost = (value: number): string =>
  `$${value.toFixed(value < 0.01 ? 4 : 2)}`;

function AiCredentialPanel({
  t,
  onCredentialChanged,
}: Readonly<AiCredentialPanelProps>) {
  const { aiService } = useApiServices();
  const [status, setStatus] = useState<OpenRouterCredentialStatus | null>(null);
  const [usage, setUsage] = useState<OpenRouterUsageDashboard | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    const result = await aiService.getUsageDashboard();
    setUsage(result.data);
    setLoadingUsage(false);
    if (result.error)
      setMessage({ kind: "error", text: t("usageUnavailable") });
  }, [aiService, t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const nextStatus = await aiService.getCredentialStatus();
      if (!active) return;
      setStatus(nextStatus);
      if (nextStatus?.hasPersonalKey) await loadUsage();
    })();
    return () => {
      active = false;
    };
  }, [aiService, loadUsage]);

  const saveCredential = async () => {
    if (!apiKey.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await aiService.updateCredential(apiKey.trim());
    setBusy(false);
    if (!result.data) {
      setMessage({ kind: "error", text: result.error || t("apiKeySaveError") });
      return;
    }
    setStatus(result.data);
    setApiKey("");
    setShowKey(false);
    setMessage({ kind: "success", text: t("apiKeySaved") });
    await Promise.all([loadUsage(), onCredentialChanged()]);
  };

  const removeCredential = async () => {
    setBusy(true);
    setMessage(null);
    const result = await aiService.removeCredential();
    setBusy(false);
    if (!result.data) {
      setMessage({
        kind: "error",
        text: result.error || t("apiKeyRemoveError"),
      });
      return;
    }
    setStatus(result.data);
    setUsage(null);
    setMessage({ kind: "success", text: t("apiKeyRemoved") });
    await onCredentialChanged();
  };

  const statusLabel =
    status?.source === "personal"
      ? t("personalKeyActive")
      : status?.source === "server"
        ? t("serverKeyActive")
        : t("aiUnavailable");

  return (
    <div className="ai-credential-panel">
      <div className="ai-credential-heading">
        <div>
          <h4 className="ai-credential-title">{t("openRouterApiKey")}</h4>
          <div className={`ai-credential-status ${status?.source || "none"}`}>
            <span className="ai-status-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
            {status?.keyHint && <code>{status.keyHint}</code>}
          </div>
        </div>
        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noreferrer"
        >
          {t("createOpenRouterKey")}
          <span className="codicon codicon-link-external" aria-hidden="true" />
        </a>
      </div>

      <div className="ai-key-controls">
        <label className="ai-key-input-wrap">
          <span className="sr-only">{t("openRouterApiKey")}</span>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              status?.hasPersonalKey
                ? t("replaceApiKey")
                : t("openRouterKeyPlaceholder")
            }
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <button
            type="button"
            className="ai-key-visibility"
            onClick={() => setShowKey((visible) => !visible)}
            title={showKey ? t("hideApiKey") : t("showApiKey")}
            aria-label={showKey ? t("hideApiKey") : t("showApiKey")}
          >
            <span
              className={`codicon codicon-${showKey ? "eye-closed" : "eye"}`}
              aria-hidden="true"
            />
          </button>
        </label>
        <button
          type="button"
          className="profile-primary-action"
          onClick={saveCredential}
          disabled={busy || !apiKey.trim()}
        >
          <span className="codicon codicon-key" aria-hidden="true" />
          {status?.hasPersonalKey ? t("replaceApiKey") : t("saveApiKey")}
        </button>
        {status?.hasPersonalKey && (
          <button
            type="button"
            className="profile-danger-action"
            onClick={removeCredential}
            disabled={busy}
          >
            <span className="codicon codicon-trash" aria-hidden="true" />
            {t("removeApiKey")}
          </button>
        )}
      </div>

      {message && (
        <p className={`ai-credential-message ${message.kind}`} role="status">
          {message.text}
        </p>
      )}

      {status?.hasPersonalKey && (
        <div className="ai-usage-dashboard">
          <div className="ai-usage-heading">
            <div>
              <h4>{t("usageDashboard")}</h4>
              <span>
                {t("thoughtyUsagePeriod", {
                  days: usage?.thoughty.periodDays ?? 30,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={loadUsage}
              disabled={loadingUsage}
              title={t("refreshUsage")}
              aria-label={t("refreshUsage")}
            >
              <span
                className={`codicon codicon-refresh${loadingUsage ? " codicon-modifier-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {usage && (
            <>
              <dl className="ai-usage-grid">
                <div>
                  <dt>{t("totalTokens")}</dt>
                  <dd>{formatNumber(usage.thoughty.totalTokens)}</dd>
                </div>
                <div>
                  <dt>{t("promptTokens")}</dt>
                  <dd>{formatNumber(usage.thoughty.promptTokens)}</dd>
                </div>
                <div>
                  <dt>{t("completionTokens")}</dt>
                  <dd>{formatNumber(usage.thoughty.completionTokens)}</dd>
                </div>
                <div>
                  <dt>{t("thoughtyCost")}</dt>
                  <dd>{formatCost(usage.thoughty.cost)}</dd>
                </div>
                <div>
                  <dt>{t("reasoningTokens")}</dt>
                  <dd>{formatNumber(usage.thoughty.reasoningTokens)}</dd>
                </div>
                <div>
                  <dt>{t("requests")}</dt>
                  <dd>{formatNumber(usage.thoughty.requests)}</dd>
                </div>
              </dl>
              <div className="ai-provider-usage">
                <h5>{usage.provider.label || t("openRouterKeyUsage")}</h5>
                <dl>
                  <div>
                    <dt>{t("allTimeCost")}</dt>
                    <dd>{formatCost(usage.provider.usage)}</dd>
                  </div>
                  <div>
                    <dt>{t("monthlyCost")}</dt>
                    <dd>{formatCost(usage.provider.usageMonthly)}</dd>
                  </div>
                  <div>
                    <dt>{t("dailyCost")}</dt>
                    <dd>{formatCost(usage.provider.usageDaily)}</dd>
                  </div>
                  <div>
                    <dt>{t("remainingLimit")}</dt>
                    <dd>
                      {usage.provider.limitRemaining == null
                        ? t("unlimited")
                        : formatCost(usage.provider.limitRemaining)}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AiCredentialPanel;
