/**
 * Small generated files for seeded attachments, uploaded to the same
 * S3-compatible bucket and key scheme the API uses.
 */
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AttachmentKind } from './seed-journal';

export interface SeedAsset {
    originalFilename: string;
    mimetype: string;
    body: Buffer;
    transcript?: string;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/** A sunset-colored gradient PNG. */
function sunsetPng(width = 320, height = 200): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
    const rows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3);
        const t = y / height;
        for (let x = 0; x < width; x++) {
            row[1 + x * 3] = Math.round(250 - 120 * t);
            row[2 + x * 3] = Math.round(170 - 110 * t + 20 * Math.sin(x / 30));
            row[3 + x * 3] = Math.round(90 + 110 * t);
        }
        rows.push(row);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header),
        pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

/** A one-page PDF with a line of text. */
function notePdf(text: string): Buffer {
    const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

/** A short mono WAV tone standing in for a voice note. */
function toneWav(seconds = 1.5, sampleRate = 8000): Buffer {
    const samples = Math.floor(seconds * sampleRate);
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
        buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), 44 + i * 2);
    }
    return buffer;
}

export function createSeedAsset(kind: AttachmentKind): SeedAsset {
    switch (kind) {
        case 'image':
            return { originalFilename: 'sunset.png', mimetype: 'image/png', body: sunsetPng() };
        case 'text':
            return {
                originalFilename: 'reading-list.txt',
                mimetype: 'text/plain',
                body: Buffer.from('Books to read this year\n\n- Four Thousand Weeks\n- The Overstory\n- Meditations (again)\n'),
            };
        case 'pdf':
            return { originalFilename: 'lease-summary.pdf', mimetype: 'application/pdf', body: notePdf('Notes from the lease signing') };
        case 'audio':
            return {
                originalFilename: 'voice-note.wav',
                mimetype: 'audio/wav',
                body: toneWav(),
                transcript: 'Quick voice note on the walk home: remember to call Dad on Sunday and book the dentist.',
            };
    }
}

/** Uploads assets to the configured bucket, or returns null when object storage is unreachable. */
export async function createAssetUploader(env: NodeJS.ProcessEnv): Promise<((asset: SeedAsset) => Promise<string>) | null> {
    const bucket = env.S3_BUCKET || 'thoughty-attachments';
    const client = new S3Client({
        endpoint: env.S3_ENDPOINT || 'http://localhost:9000',
        region: env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY || 'minioadmin',
            secretAccessKey: env.S3_SECRET_KEY || 'minioadmin',
        },
        forcePathStyle: true,
        maxAttempts: 1,
    });
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status !== 404) return null;
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    return async (asset) => {
        const key = `${randomUUID()}${asset.originalFilename.slice(asset.originalFilename.lastIndexOf('.'))}`;
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: asset.body, ContentType: asset.mimetype }));
        return key;
    };
}
