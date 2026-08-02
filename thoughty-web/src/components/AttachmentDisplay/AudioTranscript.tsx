import { useState } from "react";
import type { AttachmentsService } from "../../services/api";
import type { Attachment } from "../../types";

interface AudioTranscriptProps {
  readonly attachment: Attachment;
  readonly attachmentsService: AttachmentsService;
  readonly isDark: boolean;
  readonly t: (key: string) => string;
}

function AudioTranscript({
  attachment,
  attachmentsService,
  isDark,
  t,
}: AudioTranscriptProps) {
  const [transcript, setTranscript] = useState(
    attachment.transcript?.trim() ?? "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  const transcribe = async () => {
    setIsLoading(true);
    setHasError(false);
    const result = await attachmentsService.transcribeAttachment(attachment.id);
    setIsLoading(false);
    if (!result) {
      setHasError(true);
      return;
    }
    setTranscript(result.transcript);
  };

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

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
        {hasError && (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {t("audioTranscriptionFailed")}
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
