/** The first bytes of real video and picture files, enough for the signature checks. */
function isoBaseMedia(atom: string, brand = ''): Buffer {
  return Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from(atom + brand, 'latin1'), Buffer.alloc(52)]);
}

function ebml(docType: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04]),
    Buffer.from([0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x80 | docType.length]),
    Buffer.from(docType, 'latin1'),
    Buffer.alloc(16),
  ]);
}

export const VIDEO_HEADS = {
  mp4: isoBaseMedia('ftyp', 'isom'),
  m4v: isoBaseMedia('ftyp', 'M4V '),
  quicktime: isoBaseMedia('ftyp', 'qt  '),
  legacyQuicktime: isoBaseMedia('moov'),
  webm: ebml('webm'),
  matroska: ebml('matroska'),
  heic: isoBaseMedia('ftyp', 'heic'),
  m4a: isoBaseMedia('ftyp', 'M4A '),
};

/** A JPEG start with a frame header of `width` by `height`, as a canvas writes it. */
export function jpegOf(width: number, height: number): Buffer {
  const frame = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03]);
  frame.writeUInt16BE(height, 7);
  frame.writeUInt16BE(width, 9);
  return Buffer.concat([frame, Buffer.alloc(20)]);
}
