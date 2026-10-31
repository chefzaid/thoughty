import { describe, expect, it, vi } from 'vitest';
import {
    attachmentIdOf,
    inlineImageMarkdown,
    inlineImagesToAltText,
    insertAtSelection,
    keepAttachmentSources,
    placedAttachmentIds,
    storePlacedFiles,
} from './inlineImages';

const file = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('inline images', () => {
    it('reads the attachment ID of an image source', () => {
        expect(attachmentIdOf('attachment:12')).toBe(12);
        expect(attachmentIdOf('attachment:0')).toBeNull();
        expect(attachmentIdOf('attachment:pier.png')).toBeNull();
        expect(attachmentIdOf('https://example.com/a.png')).toBeNull();
        expect(attachmentIdOf(undefined)).toBeNull();
    });

    it('lists the attachments a text places, not the files still to upload', () => {
        expect(placedAttachmentIds('![a](attachment:3) ![b](attachment:pier.png) ![c](attachment:3) ![d](attachment:4)'))
            .toEqual(new Set([3, 4]));
    });

    it('writes references with escaped one-line alt text', () => {
        expect(inlineImageMarkdown(7, ' The [old]\n pier ')).toBe('![The \\[old\\] pier](attachment:7)');
        expect(inlineImageMarkdown('pier one.png', '')).toBe('![](attachment:pier%20one.png)');
    });

    it('replaces the selection and puts the caret after the snippet, within the text', () => {
        expect(insertAtSelection('Hello world', { start: 6, end: 11 }, 'there')).toEqual({ text: 'Hello there', caret: 11 });
        expect(insertAtSelection('Hi', { start: 99, end: 99 }, '!')).toEqual({ text: 'Hi!', caret: 3 });
    });

    it('keeps attachment sources and checks every other one', () => {
        const check = vi.fn(() => '');
        expect(keepAttachmentSources('attachment:5', check)).toBe('attachment:5');
        expect(check).not.toHaveBeenCalled();
        expect(keepAttachmentSources('javascript:alert(1)', check)).toBe('');
    });

    it('uploads the picked files the text places first, and points their references at them', async () => {
        const pier = file('pier one.png');
        const sea = file('sea.png');
        const twin = file('pier one.png');
        const upload = vi.fn(async () => ({ id: 41 }));

        const result = await storePlacedFiles('A ![Pier](attachment:pier%20one.png) B ![x](attachment:9)', [pier, sea, twin], upload);

        expect(upload).toHaveBeenCalledTimes(1);
        expect(upload).toHaveBeenCalledWith(pier);
        expect(result).toEqual({ text: 'A ![Pier](attachment:41) B ![x](attachment:9)', remaining: [sea, twin] });
    });

    it('keeps the text when nothing it places could be uploaded', async () => {
        const pier = file('pier.png');
        const text = '![Pier](attachment:pier.png) ![bad](attachment:%E0%A4%A)';
        await expect(storePlacedFiles(text, [pier], async () => null)).resolves.toEqual({ text, remaining: [] });
        await expect(storePlacedFiles('none', [pier], async () => null)).resolves.toEqual({ text: 'none', remaining: [pier] });
    });

    it('turns the pictures a text places into their alt text, escaped only in Markdown', () => {
        const text = 'Before ![The \\[old\\] pier](attachment:7) and ![](attachment:pier.png) ![Web](https://example.com/a.png)';
        expect(inlineImagesToAltText(text, 'markdown')).toBe('Before The \\[old\\] pier and  ![Web](https://example.com/a.png)');
        expect(inlineImagesToAltText(text, 'plain')).toBe('Before The [old] pier and  ![Web](https://example.com/a.png)');
    });
});
