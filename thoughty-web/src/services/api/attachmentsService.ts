import type { components } from "../../generated/openapi";
import type { Attachment } from "../../types";
import { isVideoAttachment } from "../../utils/attachments";
import { captureVideoPoster } from "../../utils/videoPoster";

/** What an upload or a link answers: the attachment with its entry and upload time. */
type AttachmentRecord = components["schemas"]["AttachmentRecordResponseDto"];

export type AudioTranscription = components["schemas"]["AudioTranscriptionResponseDto"];

/** The form a poster frame is sent in. */
export function posterForm(poster: Blob): FormData {
  const form = new FormData();
  form.append("file", poster, "poster.jpg");
  return form;
}

export const createAttachmentsService = (
  authFetch: (url: string, options?: RequestInit) => Promise<Response>,
) => {
  /** Stores a video's poster frame; answers the video's record with it, or null when it was not stored. */
  const uploadPoster = async (
    attachmentId: number,
    poster: Blob,
  ): Promise<Attachment | null> => {
    try {
      const response = await authFetch(`/api/attachments/${attachmentId}/poster`, {
        method: "POST",
        body: posterForm(poster),
      });
      return response.ok ? ((await response.json()) as AttachmentRecord) : null;
    } catch (error) {
      console.error("Error uploading poster frame:", error);
      return null;
    }
  };

  /**
   * Gives a just-stored video the poster frame the browser draws from `file`. Without one (the
   * browser cannot decode the video, or the upload failed) the video keeps no poster and the app
   * shows a video icon in its place.
   */
  const attachPoster = async (attachment: Attachment, file: Blob): Promise<Attachment> => {
    if (!isVideoAttachment(attachment.mimetype)) {
      return attachment;
    }
    const poster = await captureVideoPoster(file);
    return (poster && (await uploadPoster(attachment.id, poster))) || attachment;
  };

  const uploadAttachment = async (
    file: File,
    entryId?: number,
  ): Promise<Attachment | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (entryId) {
        formData.append("entryId", entryId.toString());
      }

      const response = await authFetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        return attachPoster((await response.json()) as AttachmentRecord, file);
      }
      return null;
    } catch (error) {
      console.error("Error uploading attachment:", error);
      return null;
    }
  };

  const linkAttachment = async (
    attachmentId: number,
    entryId: number,
  ): Promise<boolean> => {
    try {
      const response = await authFetch(
        `/api/attachments/${attachmentId}/link`,
        {
          method: "POST",
          body: JSON.stringify({ entryId }),
        },
      );
      return response.ok;
    } catch (error) {
      console.error("Error linking attachment:", error);
      return false;
    }
  };

  const deleteAttachment = async (id: number): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/attachments/${id}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return false;
    }
  };

  const transcribeAttachment = async (
    id: number,
  ): Promise<AudioTranscription | null> => {
    try {
      const response = await authFetch(`/api/attachments/${id}/transcribe`, {
        method: "POST",
      });
      return response.ok
        ? ((await response.json()) as AudioTranscription)
        : null;
    } catch (error) {
      console.error("Error transcribing attachment:", error);
      return null;
    }
  };

  return {
    uploadAttachment,
    linkAttachment,
    deleteAttachment,
    transcribeAttachment,
  };
};

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
