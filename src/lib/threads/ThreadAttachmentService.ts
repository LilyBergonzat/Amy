import type { Attachment, Message, MessageSnapshot } from 'discord.js';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';

export async function saveAttachment(threadId: string, attachment: Attachment) {
    const dirPath = `./data/attachments/${threadId}`;
    const filePath = path.join(dirPath, attachment.id);

    if (fs.existsSync(filePath)) {
        return;
    }

    const response = await fetch(attachment.url);
    const body = response.body;

    if (!response.ok || !body) {
        return;
    }

    await mkdir(dirPath, { recursive: true });
    await pipeline(Readable.fromWeb(body as ReadableStream), createWriteStream(filePath));

    return {
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        width: attachment.width,
        height: attachment.height,
        spoiler: attachment.spoiler,
        description: attachment.description,
    };
}

export async function buildStickersData(message: Message | MessageSnapshot | null | undefined) {
    return [...(message?.stickers.values() ?? [])].map((sticker) => ({
        id: sticker.id,
        name: sticker.name,
        format: sticker.format,
        description: sticker.description,
    }));
}
