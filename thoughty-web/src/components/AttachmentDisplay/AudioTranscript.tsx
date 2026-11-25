import { useState } from "react";
import type { AttachmentsService } from "../../services/api";
import type { Attachment } from "../../types";
import { tintedTextClass } from "../../utils/tintedText";
import { useFeatureFlag } from "../FeatureFlags/featureFlags";
import { confirmAiRequest } from "../DiaryAi/aiConsent";
import { useRequestAiConsent } from "../DiaryAi/aiConsentContext";
import { diaryOffersAi, type DiaryAiMode } from "../../utils/diaryAi";
import { readAudioDuration } from "../../utils/audioDuration";
import { recordingTranscriptions } from "../../services/speech/recordingTranscriptions";
import { speechLanguage } from "../../services/speech/speechProtocol";
import { useRecordingTranscription } from "../../hooks/useRecordingTranscription";
import DeviceSpeechProgress from "../DeviceSpeech/DeviceSpeechProgress";

interface AudioTranscriptProps {
  readonly attachment: Attachment;
  readonly attachmentsService: AttachmentsService;
  readonly isDark: boolean;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * The AI mode of the entry's diary: with AI off a recording without a transcript offers none, a diary that asks
   * each time shows the writer the recording and where it goes before sending it, and one on the writer's own model
   * transcribes it on this device (`recordingTranscriptions`, started on its own when the entry is saved),
   * Thoughty's server keeping only the text.
   */
  readonly aiMode?: DiaryAiMode;
  /** The recording's address in the page, to read its length for that preview. */
  readonly sourceUrl?: string | null;
}

/** The transcribe button's words: working, trying again after a failure on this device, or the first try. */
function transcribeLabel(loading: boolean, retry: boolean, t: (key: string) => string): string {
  if (loading) return t("transcribingAudio");
  return retry ? t("deviceSpeechRetry") : t("transcribeAudio");
}

function AudioTranscript({
  attachment,
  attachmentsService,
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

  // In a diary on the writer's own model the recording is transcribed on this device, in the background
  const onDevice = aiMode === "local";
  const device = useRecordingTranscription(attachment.id);
  const shownTranscript = device?.phase === "done" ? device.transcript : transcript;

  /** The transcript from Thoughty's provider, once a diary that asks each time has been asked. */
  const transcribeOnServer = async () => {
    setIsLoading(true);
    setProblem(null);
    const seconds = aiMode === "ask" ? await readAudioDuration(sourceUrl) : null;
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      task: "transcription",
      recording: { name: attachment.original_filename, seconds },
    });
    const result = consent.send ? await attachmentsService.transcribeAttachment(attachment.id, null, consent.aiConsent) : null;
    setIsLoading(false);
    if (result) setTranscript(result.transcript);
    else if (consent.send) setProblem("audioTranscriptionFailed");
  };

  const transcribe = () => {
    if (!onDevice) return transcribeOnServer();
    recordingTranscriptions.transcribe({ attachments: [attachment], attachmentsService, language: speechLanguage(t("languageCode")) });
  };

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(shownTranscript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Transcribing is AI: while AI is switched off a recording without a transcript offers none
  if (!shownTranscript && !aiOn) {
    return null;
  }

  const deviceStep = onDevice && device && device.phase !== "done" && device.phase !== "failed" ? device : null;
  if (deviceStep) {
    return <DeviceSpeechProgress step={deviceStep} t={t} className="mt-3 border-t border-current/10 pt-3" />;
  }

  if (!shownTranscript) {
    const failure = onDevice && device?.phase === "failed" ? device.problem : problem;
    return (
      <div className="mt-3 border-t border-current/10 pt-3">
        <button
          type="button"
          onClick={() => void transcribe()}
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
          {transcribeLabel(isLoading, onDevice && failure !== null, t)}
        </button>
        {failure && (
          <p className={`mt-1 text-xs ${tintedTextClass("red", isDark ? "dark" : "light")}`} role="alert">
            {t(failure)}
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
        {shownTranscript}
      </p>
    </div>
  );
}

export default AudioTranscript;
