import type { SpeechProgress } from "../../services/speech/speechProtocol";

/** A transcription on this device still under way: waiting its turn, getting ready, or one of the worker's steps. */
export type DeviceSpeechStep = { readonly phase: "queued" } | { readonly phase: "preparing" } | SpeechProgress;

const MEGABYTE = 1_000_000;

interface DeviceSpeechProgressProps {
  readonly step: DeviceSpeechStep;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly className?: string;
}

/** The message for a step, with the model's first download in megabytes so far of all its files. */
function stepMessage(step: DeviceSpeechStep, t: DeviceSpeechProgressProps["t"]): string {
  switch (step.phase) {
    case "queued":
      return t("deviceSpeechQueued");
    case "preparing":
      return t("deviceSpeechPreparing");
    case "downloading":
      return t("deviceSpeechDownloading", {
        loaded: Math.round(step.loaded / MEGABYTE),
        total: Math.round(step.total / MEGABYTE),
      });
    case "transcribing":
      return t("deviceSpeechTranscribing");
  }
}

/** Says, as it goes, where a recording's transcription on this device is, with a bar while the model downloads. */
function DeviceSpeechProgress({ step, t, className = "" }: DeviceSpeechProgressProps) {
  return (
    <div role="status" className={className}>
      <p className="flex items-center gap-2 text-xs">
        <i className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" />
        {stepMessage(step, t)}
      </p>
      {step.phase === "downloading" && step.total > 0 && (
        <progress
          className="mt-1 h-1.5 w-full max-w-xs"
          max={step.total}
          value={step.loaded}
          aria-label={t("deviceSpeechDownloadLabel")}
        />
      )}
    </div>
  );
}

export default DeviceSpeechProgress;
