import { container } from '@sapphire/framework';
import { Prisma, type Thread, ThreadOpen } from '../../generated/prisma/client.js';
import { type Attachment, type GuildMember, type Message, MessageReferenceType, type User } from 'discord.js';
import { ThreadPostService } from './ThreadPostService.js';
import { getSendableChannel } from '../utils/discord.js';
import { ThreadLogService } from './ThreadLogService.js';
import { buildStickersData, saveAttachment } from './ThreadAttachmentService.js';
import { buildMentionsData } from '../utils/mention.js';

export const computeUserData = async (user: User): Promise<UserData> => {
    const guild = await container.settings.getInboxServer();
    const member = await guild?.members.fetch(user.id).catch(() => null);

    return {
        ...user.toJSON()!,
        displayName: member?.displayName ?? user.displayName,
        displayAvatarURL:
            member?.displayAvatarURL({ forceStatic: true }) ?? user.displayAvatarURL({ forceStatic: true }),
        displayAvatarURLAnimated: member?.displayAvatarURL() ?? user.displayAvatarURL(),
    } as UserData;
};

export type UserData = {
    id: string;
    bot: boolean;
    system: boolean;
    flags: number;
    username: string;
    globalName: string;
    discriminator: string;
    avatar: string;
    banner: null;
    accentColor: null;
    avatarDecoration: null;
    avatarDecorationData: {
        asset: string;
        skuId: string;
    };
    collectibles: {
        nameplate: {
            skuId: string;
            asset: string;
            label: string;
            palette: string;
        };
    };
    primaryGuild: {
        identityGuildId: string;
        identityEnabled: boolean;
        tag: string;
        badge: string;
    };
    createdTimestamp: number;
    defaultAvatarURL: string;
    hexAccentColor: null;
    tag: string;
    avatarURL: string;
    bannerURL: null;
    guildTagBadgeURL: string;
    displayName: string;
    displayAvatarURL: string;
    displayAvatarURLAnimated: string;
};

export type ThreadWithMessages = Prisma.ThreadGetPayload<{
    include: { messages: true };
}>;

export type ThreadWithMessagesAndAttachments = Prisma.ThreadGetPayload<{
    include: { messages: { include: { attachments: true } } };
}>;

export class ThreadService {
    private static instance: ThreadService;

    private postService!: ThreadPostService;
    private logService!: ThreadLogService;

    public constructor() {
        if (ThreadService.instance) {
            return ThreadService.instance;
        }

        this.postService = new ThreadPostService();
        this.logService = new ThreadLogService();
        ThreadService.instance = this;
    }

    public async getOpenThread(recipient: User, openedBy: User): Promise<ThreadWithMessages | null> {
        const thread = await container.prisma.thread.findUnique({
            where: {
                idRecipient_isOpen: {
                    idRecipient: recipient.id,
                    isOpen: ThreadOpen.OPEN,
                },
            },
            include: { messages: true },
        });

        return thread ? this.ensureValidThread(thread, recipient, openedBy) : null;
    }

    public async getOpenThreadOrCreate(recipient: User, openedBy: User): Promise<ThreadWithMessages | null> {
        return (
            (await container.threads.getOpenThread(recipient, openedBy)) ??
            (await this.createThread(recipient, openedBy))
        );
    }

    public async createThread(user: User, openedBy: User): Promise<ThreadWithMessages | null> {
        const category = await container.settings.getInboxCategory();

        if (!category) {
            return null;
        }

        const channel = await category.guild.channels
            .create({
                parent: category,
                name: `↳${user.username}`,
            })
            .catch((e) => container.logger.error(e));

        if (!channel) {
            return null;
        }

        try {
            await channel.lockPermissions();
        } catch (e) {
            container.logger.error(e);
            return null;
        }

        const newThreadPing = await container.settings.get('new-thread-ping');
        const newThreadMessage = await container.settings.get('new-thread-message');

        if (user.id === openedBy.id && (newThreadPing || newThreadMessage)) {
            await channel.send(`${newThreadPing ? `<@&${newThreadPing}>` : ''}\n${newThreadMessage ?? ''}`);
        }

        return await container.prisma.thread.create({
            data: {
                idOpenedBy: openedBy.id,
                openedByData: JSON.stringify(await computeUserData(openedBy)),
                openedByUser: user.id === openedBy.id,
                idRecipient: user.id,
                recipientData: JSON.stringify(await computeUserData(user)),
                isOpen: ThreadOpen.OPEN,
                idChannel: channel.id,
            },
            include: { messages: true },
        });
    }

    public async getThreadByChannel(channelId: string) {
        return container.prisma.thread.findUnique({
            where: {
                idChannel: channelId,
            },
        });
    }

    public async saveInternalMessage(thread: Thread, message: Message) {
        return await container.prisma.threadMessage.create({
            data: {
                idMessage: message.id,
                idThread: thread.id,
                idStaff: String(message.author.id),
                messageData: JSON.stringify(message.toJSON()),
                senderData: JSON.stringify(await computeUserData(message.author)),
                contents: message.content,
                stickersData: JSON.stringify(await buildStickersData(message)),
                mentionsData: JSON.stringify(await buildMentionsData(message.content)),
                ...(await this.getAttachmentData(thread.id, [...message.attachments.values()])),
                internal: true,
            },
        });
    }

    public async saveUserMessage(thread: Thread, message: Message, transferredMessage: Message) {
        const messageData =
            message.reference?.type === MessageReferenceType.Forward ? message.messageSnapshots.first() : message;

        return await container.prisma.threadMessage.create({
            data: {
                idMessage: message.id,
                idThread: thread.id,
                idTransferredMessage: transferredMessage.id,
                messageData: JSON.stringify(message.toJSON()),
                senderData: JSON.stringify(await computeUserData(message.author)),
                contents: messageData?.content ?? '',
                stickersData: JSON.stringify(await buildStickersData(messageData)),
                mentionsData: JSON.stringify(await buildMentionsData(messageData?.content)),
                ...(await this.getAttachmentData(thread.id, [...(messageData?.attachments.values() ?? [])])),
                forwarded: message.reference?.type === MessageReferenceType.Forward,
                internal: false,
            },
        });
    }

    public async saveStaffMessage(
        thread: Thread,
        contents: string | null,
        staff: User,
        transferredMessage: Message,
        anonymous: boolean,
        message?: Message,
    ) {
        return await container.prisma.threadMessage.create({
            data: {
                idMessage: message?.id,
                idThread: thread.id,
                idStaff: staff.id,
                idTransferredMessage: transferredMessage.id,
                messageData: message ? JSON.stringify(message.toJSON()) : null,
                senderData: JSON.stringify(await computeUserData(staff)),
                contents: contents ?? '',
                stickersData: message ? JSON.stringify(await buildStickersData(message)) : undefined,
                mentionsData: JSON.stringify(await buildMentionsData(contents)),
                ...(message ? await this.getAttachmentData(thread.id, [...message.attachments.values()]) : {}),
                internal: false,
                anonymous,
            },
        });
    }

    public async sendMessageFromUser(thread: Thread, message: Message) {
        const transferredMessage = await this.postService.postUserMessage(thread, message);

        if (!transferredMessage) {
            return null;
        }

        await this.saveUserMessage(thread, message, transferredMessage);

        return transferredMessage;
    }

    public async sendMessageFromStaff(
        thread: Thread,
        contents: string | null,
        staff: GuildMember,
        message?: Message,
        anonymousOverride?: boolean,
    ) {
        const transferredMessage = await this.postService.postStaffMessage(
            thread,
            contents,
            staff,
            message,
            anonymousOverride,
        );

        if (!transferredMessage) {
            return;
        }

        await this.saveStaffMessage(
            thread,
            contents,
            staff.user,
            transferredMessage,
            await container.settings.isAnonymous(anonymousOverride),
            message,
        );

        await message?.delete();

        return transferredMessage;
    }

    public async closeThread(thread: Thread, delay?: number | null) {
        if (delay) {
            await container.prisma.thread.update({
                where: { id: thread.id },
                data: { scheduledClose: new Date(Date.now() + delay) },
            });

            return;
        }

        const channel = await getSendableChannel(thread.idChannel);

        if (!channel) {
            console.warn(`Tried to close thread ${thread.id} and failed: could not fetch thread channel.`);
        }

        const channelId = channel?.id;

        await channel?.delete('Thread closed.');
        await this.logService.logClosedThread(thread, channelId);

        await container.prisma.thread.update({
            where: { id: thread.id },
            data: { closedAt: new Date(), isOpen: null },
        });
    }

    public async getThreadChannel(thread: Thread) {
        return getSendableChannel(thread.idChannel);
    }

    private async getAttachmentData(threadId: string, attachments: Attachment[]) {
        const data =
            attachments.length > 0 ?
                (await Promise.all(attachments.map((attachment) => saveAttachment(threadId, attachment)))).filter(
                    (attachment) => attachment !== undefined,
                )
            :   [];

        return data.length > 0 ? { attachments: { create: data } } : {};
    }

    private async ensureValidThread(
        thread: ThreadWithMessages,
        recipient: User,
        openedBy: User,
    ): Promise<ThreadWithMessages | null> {
        const channel = await getSendableChannel(thread.idChannel);
        let fixedThread: ThreadWithMessages | null = thread;

        if (!channel) {
            await this.closeThread(thread);
            fixedThread = await this.createThread(recipient, openedBy);
        }

        return fixedThread;
    }
}
