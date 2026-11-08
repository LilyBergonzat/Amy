import type { Attachment, Message, MessageSnapshot } from 'discord.js';
import { mkdir, rename, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';
import { fileTypeFromFile } from 'file-type';

type AttachmentLike =
    | Attachment
    | {
          id: string;
          name: string;
          url: string;
          contentType?: string | null;
          size?: number | null;
          width?: number | null;
          height?: number | null;
          spoiler?: boolean | null;
          description?: string | null;
      };

export async function readHead(path: string, bytes: number) {
    const blob = await fs.openAsBlob(path);

    if (!blob) {
        return new Uint8Array();
    }

    return blob.slice(0, bytes).arrayBuffer();
}

export async function detectMime(path: string): Promise<string | null> {
    const type = await fileTypeFromFile(path);

    if (type) {
        return type.mime;
    }

    const head = await readHead(path, 1024);
    let text;

    try {
        text = new TextDecoder('utf-8', { fatal: true })
            .decode(head)
            .replace(/^\uFEFF/v, '')
            .trimStart();
    } catch {
        return 'text/plain';
    }

    if (/^(?:<\?xml[^>]*>\s*)?(?:<!--.*?-->\s*)*<svg[\s>]/isv.test(text)) {
        return 'image/svg+xml';
    }

    if (/^(?:<!doctype html|<html[\s>])/iv.test(text)) {
        return 'text/html';
    }

    return 'text/plain';
}

export function getAttachmentPath(threadId: string) {
    return `./data/attachments/${threadId}`;
}

export function attachmentExists(threadId: string, attachmentId: string) {
    return fs.existsSync(path.join(getAttachmentPath(threadId), attachmentId));
}

export async function saveAttachment(threadId: string, attachment: AttachmentLike) {
    const dirPath = `./data/attachments/${threadId}`;
    const filePath = path.join(dirPath, attachment.id);
    const tempPath = `${filePath}.part`;
    const metadata = {
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size ?? 0,
        width: attachment.width,
        height: attachment.height,
        spoiler: attachment.spoiler ?? attachment.name.startsWith('SPOILER_'),
        description: attachment.description,
    };

    if (fs.existsSync(filePath)) {
        metadata.size = fs.statSync(filePath).size;
        metadata.contentType ??= await detectMime(filePath);

        return metadata;
    }

    const response = await fetch(attachment.url).catch(() => null);
    const body = response?.body;

    if (!response?.ok || !body) {
        await response?.body?.cancel();
        return;
    }

    await mkdir(dirPath, { recursive: true });

    try {
        await pipeline(Readable.fromWeb(body as ReadableStream), createWriteStream(tempPath));
        await rename(tempPath, filePath);
    } catch (error) {
        await rm(tempPath, { force: true });
        console.error(`Failed to save attachment ${attachment.id}:`, error);

        return;
    }

    metadata.size = fs.statSync(filePath).size;
    metadata.contentType ??= await detectMime(filePath);

    return metadata;
}

export async function buildStickersData(message: Message | MessageSnapshot | null | undefined) {
    return [...(message?.stickers.values() ?? [])].map((sticker) => ({
        id: sticker.id,
        name: sticker.name,
        format: sticker.format,
        description: sticker.description,
    }));
}
