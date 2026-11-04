import { container } from '@sapphire/framework';
import { type Attachment, type Sticker, StickerFormatType } from 'discord.js';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export type ConvertedStickerMedia = {
    url: string;
    file: { attachment: string | Buffer<ArrayBuffer>; name: string };
    name: string;
    description: string;
    format: StickerFormatType.APNG | StickerFormatType.Lottie | StickerFormatType.GIF;
    isConverted: true;
};

export type OriginalStickerMedia = {
    url: string;
    file: null;
    name: string;
    description: string;
    format: StickerFormatType.PNG;
    isConverted: false;
};

export type StickerMedia = ConvertedStickerMedia | OriginalStickerMedia;

const STICKER_DIR = path.resolve('assets/stickers');
export const convertedStickers = new Set((await readdir(STICKER_DIR)).map((file) => path.parse(file).name));

export const resizeGifSticker = async (url: string) => {
    const source = Buffer.from(await (await fetch(url)).arrayBuffer());

    return sharp(source, { animated: true }).resize(160).webp({ loop: 0 }).toBuffer();
};

export const stickerMedia = async (sticker: Sticker): Promise<StickerMedia | null> => {
    const buildDescription = (sticker: Sticker) =>
        `Sticker "${sticker.name}"${sticker.description ? `: ${sticker.description}` : ''}`;

    if (convertedStickers.has(sticker.id)) {
        const name = `${sticker.id}.webp`;

        return {
            url: `attachment://${name}`,
            file: { attachment: path.join(STICKER_DIR, name), name },
            name: sticker.name,
            description: buildDescription(sticker),
            format: sticker.format as StickerFormatType.Lottie | StickerFormatType.APNG,
            isConverted: true,
        };
    }

    if (sticker.format === StickerFormatType.GIF) {
        const name = `${sticker.id}.webp`;

        return {
            url: `attachment://${name}`,
            file: { attachment: await resizeGifSticker(sticker.url), name },
            name: sticker.name,
            description: buildDescription(sticker),
            format: sticker.format,
            isConverted: true,
        };
    }

    if (sticker.format === StickerFormatType.PNG) {
        const url = new URL(sticker.url.replace('cdn.discordapp.com', 'media.discordapp.net'));

        url.searchParams.append('size', '160');

        return {
            url: url.toString(),
            file: null,
            name: sticker.name,
            description: buildDescription(sticker),
            format: sticker.format,
            isConverted: false,
        };
    }

    return null;
};

export async function getSendableChannel(id?: string | null) {
    if (!id) {
        return null;
    }

    const guild = await container.settings.getInboxServer();
    const channel = guild ? await guild.channels.fetch(id).catch(() => null) : null;

    return channel?.isSendable() ? channel : null;
}

export function isGalleryMedia(attachment: Attachment | null): boolean;
export function isGalleryMedia(contentType: string | null): boolean;
export function isGalleryMedia(contentTypeOrAttachment: Attachment | string | null): boolean;
export function isGalleryMedia(contentTypeOrAttachment: Attachment | string | null): boolean {
    const contentType =
        typeof contentTypeOrAttachment === 'string' ? contentTypeOrAttachment : (
            (contentTypeOrAttachment as Attachment).contentType
        );

    if (!contentType || contentType === 'image/svg+xml') {
        return false;
    }

    return contentType.startsWith('image/') || contentType.startsWith('video/');
}

export function isNotGalleryMedia(attachment: Attachment | null): boolean;
export function isNotGalleryMedia(contentType: string | null): boolean;
export function isNotGalleryMedia(contentTypeOrAttachment: Attachment | string | null): boolean;
export function isNotGalleryMedia(contentTypeOrAttachment: Attachment | string | null): boolean {
    return !isGalleryMedia(contentTypeOrAttachment);
}
