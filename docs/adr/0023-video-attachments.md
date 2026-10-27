# ADR 0023: Take Videos Through a Disk-Buffered Upload, With Poster Frames Drawn in the Browser

- Status: Accepted
- Date: 2026-10-27

## Context

Attachments were images, audio, PDF and text of at most 5 MB, read into memory by multer before they went to object storage ([ADR 0011](./0011-attachments-and-object-storage.md)), behind an ingress that caps bodies at 10 MiB. Writers coming from Day One and Journey have videos, which those importers left out. A phone records about a minute of 1080p video in 50 to 100 MB; the API pod has 512 Mi of memory and a read-only root filesystem with a `/tmp` emptyDir. A video also needs a still to show before it plays, and books and PDFs can print only a picture.

## Decision

- **Formats and limit.** MP4, WebM and QuickTime videos of up to 50 MB; every other type keeps 5 MB. QuickTime is accepted because phones record it and Safari, Chrome and Edge play it when it holds H.264; a browser that cannot play a file says so and offers the download. A video is recognized by its first bytes (an `ftyp` brand or legacy QuickTime atom, or a WebM EBML header), and the type those bytes show is stored, whatever the browser declared.
- **Upload.** `POST /api/attachments/upload` writes the file to a temporary file in `/tmp` as it arrives, so multer's 50 MB limit stops an oversized body before anything is held in memory, then streams it to object storage with its length and deletes the temporary file once the request is answered. Only this route's ingress takes 51 MiB; the others keep 10 MiB.
- **Poster frame.** The browser draws it when the video is attached: it decodes the file in a hidden `<video>`, seeks a second in, draws the frame on a canvas at most 960 pixels wide and uploads it as a JPEG of at most 1 MB (`POST /api/attachments/{id}/poster`). It is a second object on the video's row (`poster_filename`, `poster_size`), served by the same file route under the same ownership rules and deleted with the video. The server never decodes video. When the browser cannot decode a file, the video keeps no poster and the app shows an icon.
- **Playback.** The web app sends the session as a bearer token, which a `<video src>` cannot carry, so it fetches a video into a `blob:` URL, as it does every attachment, but only when the reader presses play. The file route still answers single `Range` requests (`206`, `416`) so other clients can stream and seek.
- **Elsewhere.** Books and PDF, EPUB and HTML documents print a video's poster frame with its name as caption, never the video. The Markdown folder includes videos up to 2 GB per archive and lists the others in its README. Videos are not placed inside an entry's text.

## Rationale

- A temporary file keeps memory flat whatever the number of concurrent uploads, and the limit is enforced while the body arrives, not after it is buffered. Streaming straight from the request to object storage would also avoid the disk, but the type check needs the first bytes and a refused file would leave a partial object to clean up.
- Drawing the poster in the browser needs no video decoder on the server (no `ffmpeg` in the image, no decoding of untrusted media server-side), and the browser that attached a video is the one most likely to decode it.
- Fetching a video only on play keeps the journal light: a page of entries loads posters of a few dozen kilobytes, not the videos.

## Consequences

- `/tmp` needs room for a few concurrent 50 MB uploads.
- A video's poster depends on the uploading browser; a video attached from a browser that cannot decode it has none, and none is drawn later.
- A video plays only once it has been downloaded whole into memory in the browser; very long videos would need signed, range-capable URLs instead.
