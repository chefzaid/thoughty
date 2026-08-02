import { useState } from "react";
import type { components } from "../../generated/openapi";
import "./StatsCorrelationGraph.css";

type StatsCorrelations = components["schemas"]["StatsCorrelationsDto"];

interface StatsCorrelationGraphProps {
  readonly correlations: StatsCorrelations;
  readonly themeClass: "light" | "dark";
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
}

type CorrelationMode = "entries" | "tags";

export default function StatsCorrelationGraph({
  correlations,
  themeClass,
  t,
  onOpenJournalDay,
}: Readonly<StatsCorrelationGraphProps>) {
  const [mode, setMode] = useState<CorrelationMode>("entries");
  const connections =
    mode === "entries"
      ? correlations.entryConnections
      : correlations.tagConnections;

  const renderEntryNode = (date: string, index: number) => (
    <button
      type="button"
      className="correlation-node correlation-entry-node"
      onClick={() => void onOpenJournalDay?.(date)}
      disabled={!onOpenJournalDay}
      aria-label={t("openConnectedEntry", { date, index })}
    >
      <time dateTime={date}>{date}</time>
      <span>#{index}</span>
    </button>
  );

  return (
    <section
      className={`chart-card correlation-card ${themeClass}`}
      aria-labelledby="correlation-heading"
    >
      <div className="correlation-header">
        <div>
          <h3 id="correlation-heading">{t("correlationGraph")}</h3>
          <p>{t("correlationGraphDescription")}</p>
        </div>
        <span className="correlation-sample">
          {t("correlationEntriesAnalyzed", {
            count: correlations.analyzedEntries,
          })}
        </span>
      </div>

      <div
        className="correlation-tabs"
        role="tablist"
        aria-label={t("correlationGraph")}
      >
        <button
          id="entry-connections-tab"
          type="button"
          role="tab"
          aria-selected={mode === "entries"}
          aria-controls="correlation-panel"
          onClick={() => setMode("entries")}
        >
          <span className="codicon codicon-references" aria-hidden="true" />
          {t("entryConnections")}
        </button>
        <button
          id="tag-connections-tab"
          type="button"
          role="tab"
          aria-selected={mode === "tags"}
          aria-controls="correlation-panel"
          onClick={() => setMode("tags")}
        >
          <span className="codicon codicon-tag" aria-hidden="true" />
          {t("tagConnections")}
        </button>
      </div>

      <div
        id="correlation-panel"
        className="correlation-panel"
        role="tabpanel"
        aria-labelledby={
          mode === "entries" ? "entry-connections-tab" : "tag-connections-tab"
        }
      >
        {connections.length === 0 ? (
          <p className="correlation-empty">
            {t(mode === "entries" ? "noEntryConnections" : "noTagConnections")}
          </p>
        ) : (
          <ol className="correlation-list">
            {mode === "entries"
              ? correlations.entryConnections.map((connection) => (
                  <li
                    key={`${connection.sourceEntryId}-${connection.targetEntryId}`}
                  >
                    {renderEntryNode(
                      connection.targetDate,
                      connection.targetIndex,
                    )}
                    <div className="correlation-edge">
                      <meter
                        min="0"
                        max="100"
                        value={connection.score}
                        aria-label={t("connectionStrength", {
                          score: connection.score,
                        })}
                      />
                      <strong>{connection.score}%</strong>
                      <span>{connection.sharedTags.join(" · ")}</span>
                    </div>
                    {renderEntryNode(
                      connection.sourceDate,
                      connection.sourceIndex,
                    )}
                  </li>
                ))
              : correlations.tagConnections.map((connection) => (
                  <li key={`${connection.firstTag}-${connection.secondTag}`}>
                    <span className="correlation-node">
                      {connection.firstTag}
                    </span>
                    <div className="correlation-edge tag-edge">
                      <meter
                        min="0"
                        max="100"
                        value={connection.strength}
                        aria-label={t("connectionStrength", {
                          score: connection.strength,
                        })}
                      />
                      <strong>{connection.strength}%</strong>
                      <span>
                        {t("sharedEntryCount", {
                          count: connection.sharedEntries,
                        })}
                      </span>
                    </div>
                    <span className="correlation-node">
                      {connection.secondTag}
                    </span>
                  </li>
                ))}
          </ol>
        )}
      </div>
    </section>
  );
}
