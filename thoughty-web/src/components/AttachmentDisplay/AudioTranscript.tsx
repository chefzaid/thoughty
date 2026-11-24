import { useState } from "react";
import type { AttachmentsService } from "../../services/api";
import type { Attachment } from "../../types";
import { tintedTextClass } from "../../utils/tintedText";
import { useFeatureFlag } from "../FeatureFlags/featureFlags";
import { confirmAiRequest } from "../DiaryAi/aiConsent";
import { useRequestAiConsent } from "../DiaryAi/aiConsentContext";
import { diaryOffersAi, type DiaryAiMode } from "../../utils/diaryAi";
import { readAudioDuration } from "../../utils/audioDuration";
import type { LocalAiService } from "../../services/localModel/localAiService";
import { transcribeStoredRecording } from "../../services/localModel/localTranscript";
import type { AiAnswer } from "../../services/api/aiTypes";

interface AudioTranscriptProps {
  readonly attachment: Attachment;
  readonly attachmentsService: AttachmentsService;
  /** The writer's own model, which a diary set to it transcribes with from this browser. */
  readonly localAiService: Pick<LocalAiService, "transcribe">;
  readonly isDark: boolean;
  readonly t: (key: string) => string;
  /**
   * The AI mode of the entry's diary: with AI off a recording without a transcript offers none, a diary that asks
   * each time shows the writer the recording and where it goes before sending it, and one on the writer's own model
   * sends it there from this browser, Thoughty's server keeping only the text.
   */
  readonly aiMode?: DiaryAiMode;
  /** The recording's address in the page, to read its length for that preview. */
  readonly sourceUrl?: string | null;
}

function AudioTranscript({
  attachment,
  attachmentsService,
  localAiService,
  isDark,
  t,
  aiMode = "on",
  sourceUrl = null,
}: AudioTranscriptProps) {
  const aiOn = useFeatureFlag("ai") && diaryOffersAi(aiMode, "transcription");
  const requestConsent = useRequestAiConsent();
  const [transcript, setTranscript] = useState(
    attachment.transcript?.trim() ?? "",
  );
  const [isLoading, setIsLoading] = useState(false);
  /** The translation key of why the last try gave no transcript. */
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** The transcript from Thoughty's provider, once a diary that asks each time has been asked; null when cancelled. */
  const transcribeOnServer = async (): Promise<AiAnswer<string> | null> => {
    const seconds = aiMode === "ask" ? await readAudioDuration(sourceUrl) : null;
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      task: "transcription",
      recording: { name: attachment.original_filename, seconds },
    });
    if (!consent.send) return null;
    const result = await attachmentsService.transcribeAttachment(attachment.id, null, consent.aiConsent);
    return result ? { data: result.transcript, refusal: null } : { data: null, refusal: null };
  };

  const transcribe = async () => {
    setIsLoading(true);
    setProblem(null);
    const result = aiMode === "local"
      ? await transcribeStoredRecording(attachment, attachmentsService, localAiService)
      : await transcribeOnServer();
    setIsLoading(false);
    if (!result) return;
    if (result.data === null) {
      setProblem(result.refusal ?? "audioTranscriptionFailed");
      return;
    }
    setTranscript(result.data);
  };

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Transcribing is AI: while AI is switched off a recording without a transcript offers none
  if (!transcript && !aiOn) {
    return null;
  }

  if (!transcript) {
    return (
      <div className="mt-3 border-t border-current/10 pt-3">
        <button
          type="button"
          onClick={transcribe}
          disabled={isLoading}
          className={`inline-flex min-h-8 items-center gap-2 text-xs font-medium disabled:cursor-wait disabled:opacity-60 ${
            isDark
              ? "text-blue-300 hover:text-blue-200"
              : "text-blue-700 hover:text-blue-800"
          }`}
        >
          <i
            className={`codicon ${isLoading ? "codicon-loading codicon-modifier-spin" : "codicon-record"}`}
            aria-hidden="true"
          />
          {isLoading ? t("transcribingAudio") : t("transcribeAudio")}
        </button>
        {problem && (
          <p className={`mt-1 text-xs ${tintedTextClass("red", isDark ? "dark" : "light")}`} role="alert">
            {t(problem)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-current/10 pt-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t("audioTranscript")}</p>
        <button
          type="button"
          onClick={copyTranscript}
          className={`flex size-8 items-center justify-center ${
            isDark
              ? "text-gray-300 hover:text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label={copied ? t("transcriptCopied") : t("copyTranscript")}
          title={copied ? t("transcriptCopied") : t("copyTranscript")}
        >
          <i
            className={`codicon ${copied ? "codicon-check" : "codicon-copy"}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {transcript}
      </p>
    </div>
  );
}

export default AudioTranscript;
