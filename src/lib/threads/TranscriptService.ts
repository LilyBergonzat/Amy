import { container } from '@sapphire/framework';
import { type UserData, type ThreadWithMessagesAndAttachments } from './ThreadService.js';
import type { MentionData } from '../utils/mention.js';
import type { buildStickersData } from './ThreadAttachmentService.js';
import { convertedStickers } from '../utils/discord.js';
import { StickerFormatType } from 'discord.js';

type TranscriptUserData = {
    name: string;
    avatarURL: string;
};

export type TranscriptAttachmentData = {
    id: string;
    name: string;
    contentType?: string | null;
    size: number;
    width?: number | null;
    height?: number | null;
    spoiler: boolean;
    description?: string | null;
    url: string;
};

type TranscriptStickerData = {
    id: string;
    name: string;
    description?: string | null;
    url: string;
};

type TranscriptMessage = {
    kind: 'internal' | 'staff' | 'user';
    author: TranscriptUserData;
    contents: string;
    mentions: MentionData | null;
    attachments: TranscriptAttachmentData[];
    stickers: TranscriptStickerData[];
    date: Date;
    anonymousSentBy: TranscriptUserData | null;
    forwarded: boolean;
};

const getUserData = (json: string): TranscriptUserData => {
    const data = JSON.parse(json) as UserData;

    return {
        name: data.displayName,
        avatarURL: data.displayAvatarURL,
    };
};

const getAnonymousUserData = async (): Promise<TranscriptUserData> => {
    return {
        name: (await container.settings.get('anonymous-display-name'))!,
        avatarURL: container.client.user!.displayAvatarURL(),
    };
};

export class TranscriptService {
    private thread: ThreadWithMessagesAndAttachments;

    public static async fromThreadId(id: string) {
        const thread = await container.prisma.thread.findUnique({
            where: { id },
            include: {
                messages: {
                    include: {
                        attachments: true,
                    },
                },
            },
        });

        if (!thread) {
            return null;
        }

        return new TranscriptService(thread);
    }

    private constructor(thread: ThreadWithMessagesAndAttachments) {
        this.thread = thread;
    }

    public async getThreadData() {
        return {
            openedAt: this.thread.openedAt,
            closedAt: this.thread.closedAt,
            isOpen: this.thread.isOpen,
            openedBy: this.thread.openedByData ? getUserData(this.thread.openedByData) : null,
            recipient: getUserData(this.thread.recipientData),
            openedByUser: this.thread.openedByUser !== false,
        };
    }

    public async getMessages(): Promise<TranscriptMessage[]> {
        return (
            await Promise.all(
                this.thread.messages.map(async (row) => {
                    const anonymous = !row.internal && row.idStaff && row.anonymous;

                    return {
                        kind: (row.internal ? 'internal'
                        : row.idStaff ? 'staff'
                        : 'user') as TranscriptMessage['kind'],
                        author: anonymous ? await getAnonymousUserData() : getUserData(row.senderData),
                        contents: row.contents,
                        mentions: row.mentionsData ? JSON.parse(row.mentionsData) : null,
                        attachments: row.attachments.map((attachment) => ({
                            id: attachment.id,
                            name: attachment.name,
                            contentType: attachment.contentType,
                            size: attachment.size,
                            width: attachment.width,
                            height: attachment.height,
                            spoiler: attachment.spoiler,
                            description: attachment.description,
                            url: `/thread/${row.idThread}/attachment/${attachment.id}`,
                        })),
                        stickers:
                            row.stickersData ?
                                (JSON.parse(row.stickersData) as Awaited<ReturnType<typeof buildStickersData>>).map(
                                    (sticker) => ({
                                        id: sticker.id,
                                        name: sticker.name,
                                        description: sticker.description,
                                        url:
                                            convertedStickers.has(sticker.id) ? `/stickers/${sticker.id}.webp`
                                            : sticker.format === StickerFormatType.GIF ?
                                                `https://media.discordapp.net/stickers/${sticker.id}.gif`
                                            :   `https://cdn.discordapp.com/stickers/${sticker.id}.png`,
                                    }),
                                )
                            :   [],
                        date: row.createdAt,
                        anonymousSentBy: anonymous ? getUserData(row.senderData) : null,
                        forwarded: row.forwarded,
                    };
                }),
            )
        ).sort((a, b) => {
            return a.date.getTime() - b.date.getTime();
        });
    }
}
