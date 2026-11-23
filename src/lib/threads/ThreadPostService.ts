import { type Thread, type ThreadMessage, ThreadOpen } from '../../generated/prisma/client.js';
import {
    ContainerBuilder,
    FileBuilder,
    type GuildMember,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    type Message,
    type MessageCreateOptions,
    MessageFlags,
    MessageReferenceType,
    type SendableChannels,
    SeparatorBuilder,
    type SeparatorComponent,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    type TextDisplayComponent,
    type TopLevelComponent,
} from 'discord.js';
import { container } from '@sapphire/framework';
import {
    getSendableChannel,
    isGalleryMedia,
    isNotGalleryMedia,
    type StickerMedia,
    stickerMedia,
} from '../utils/discord.js';
import type { ThreadMessageWithThread } from './ThreadService.js';
import { ComponentType } from 'discord-api-types/v10';
import { getEmojiAvatar, replaceEmojis } from '../EmojiService.js';

const COMPONENT_IDS = {
    DisplayName: 100,
    Separator: 200,
    Content: 300,
    Footer: 400,
};

export class ThreadPostService {
    private static instance: ThreadPostService;

    public constructor() {
        if (ThreadPostService.instance) {
            return ThreadPostService.instance;
        }

        ThreadPostService.instance = this;
    }

    public async postUserMessage(thread: Thread, message: Message) {
        const channel = await getSendableChannel(thread.idChannel);

        if (!channel) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        return message.reference?.type === MessageReferenceType.Forward ?
                this.postForwardedMessage(channel, message)
            :   this.postRegularMessage(channel, message);
    }

    public async postStaffMessage(
        thread: Thread,
        contents: string | null,
        staff: GuildMember,
        message?: Message,
        anonymousOverride?: boolean,
    ) {
        const guild = await container.settings.getInboxServer();
        const user = await container.client.users.fetch(thread.idRecipient).catch(() => null);

        if (!guild || !user) {
            return [];
        }

        if (message && message.partial) {
            await message.fetch();
        }

        const channel = await container.threads.getThreadChannel(thread);

        if (!channel) {
            return [];
        }

        const displayName = await container.settings.getStaffDisplayName(staff, anonymousOverride);

        if (!displayName) {
            return [];
        }

        const isAnonymous = await container.settings.isAnonymous(anonymousOverride);
        const avatar = isAnonymous ? guild.iconURL({ size: 64 }) : staff.displayAvatarURL({ size: 64 });
        const sentMessage = await user.send(await this.buildMessage(displayName, avatar, contents, message));
        const mirrorMessage = await channel
            .send(
                await this.buildMessage(
                    displayName,
                    avatar,
                    contents,
                    message,
                    isAnonymous ? `Sent anonymously by **${staff.displayName}**` : undefined,
                ),
            )
            .catch((error) => container.logger.error(error));

        return [sentMessage, mirrorMessage];
    }

    public async updateThreadMessage(threadMessage: ThreadMessageWithThread, content: string) {
        if (threadMessage.thread.isOpen !== ThreadOpen.OPEN || threadMessage.internal) {
            return;
        }

        if (!threadMessage.idStaff && threadMessage.idTransferredMessage) {
            await this.updateUserThreadMessage(threadMessage, content);
        }

        if (threadMessage.idStaff) {
            await this.updateStaffThreadMessage(threadMessage, content);
        }
    }

    public async deleteThreadMessage(threadMessage: ThreadMessageWithThread) {
        const { thread } = threadMessage;

        if (thread.isOpen !== ThreadOpen.OPEN || threadMessage.internal) {
            return;
        }

        const channel = await container.threads.getThreadChannel(thread);

        if (!channel) {
            return;
        }

        if (threadMessage.idStaff) {
            await this.deleteStaffThreadMessage(thread, threadMessage, channel);
        } else {
            await this.deleteUserThreadMessage(threadMessage, channel);
        }
    }

    private async buildMessage(
        displayName: string,
        avatar: string | null,
        contents: string | null,
        message?: Message,
        footer?: string,
    ): Promise<MessageCreateOptions> {
        const media = message ? [...message.attachments.values()].filter(isGalleryMedia) : [];
        const files = message ? [...message.attachments.values()].filter(isNotGalleryMedia) : [];
        const stickers: StickerMedia[] =
            message ?
                (await Promise.all([...message.stickers.values()].map(stickerMedia))).filter(
                    (sticker) => sticker !== null,
                )
            :   [];

        const messageContainer = await this.buildMessageContainer(displayName, avatar, contents, footer);

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [
                ...(messageContainer ? [messageContainer] : []),
                ...(media.length > 0 ?
                    [
                        new MediaGalleryBuilder().addItems(
                            media.map((attachment) => {
                                const item = new MediaGalleryItemBuilder()
                                    .setURL(`attachment://${attachment.id}-${attachment.name}`)
                                    .setSpoiler(attachment.spoiler);

                                if (attachment.description) {
                                    item.setDescription(attachment.description);
                                }

                                return item;
                            }),
                        ),
                    ]
                :   []),
                ...(stickers.length > 0 ?
                    [
                        new MediaGalleryBuilder().addItems(
                            stickers.map((stickerMedia) =>
                                new MediaGalleryItemBuilder()
                                    .setURL(stickerMedia.url)
                                    .setDescription(stickerMedia.description),
                            ),
                        ),
                    ]
                :   []),
                ...(files.length > 0 ?
                    files.map((attachment) =>
                        new FileBuilder()
                            .setURL(`attachment://${attachment.id}-${attachment.name}`)
                            .setSpoiler(attachment.spoiler),
                    )
                :   []),
            ],
            files: [
                ...[...(message?.attachments.values() ?? [])].map((attachment) => ({
                    name: `${attachment.id}-${attachment.name}`,
                    attachment: attachment.url,
                    description: attachment.description ?? undefined,
                })),
                ...stickers.filter((stickerMedia) => stickerMedia.isConverted).map((stickerMedia) => stickerMedia.file),
            ],
        };
    }

    private async buildMessageContainer(
        displayName: string,
        avatar?: string | null,
        contents?: string | null,
        footer?: string | null,
    ) {
        const emojiAvatar = avatar ? await getEmojiAvatar(avatar) : null;

        return displayName || contents || footer ?
                new ContainerBuilder()
                    .addTextDisplayComponents([
                        new TextDisplayBuilder()
                            .setContent(`${emojiAvatar ? emojiAvatar.toString() : '👤'}   **${displayName}**`)
                            .setId(COMPONENT_IDS.DisplayName),
                    ])
                    .addSeparatorComponents(
                        displayName ?
                            [
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(SeparatorSpacingSize.Small)
                                    .setId(COMPONENT_IDS.Separator),
                            ]
                        :   [],
                    )
                    .addTextDisplayComponents(
                        contents ?
                            [
                                new TextDisplayBuilder()
                                    .setContent(await replaceEmojis(contents))
                                    .setId(COMPONENT_IDS.Content),
                            ]
                        :   [],
                    )
                    .addTextDisplayComponents(
                        footer ? [new TextDisplayBuilder().setContent(`-# ${footer}`).setId(COMPONENT_IDS.Footer)] : [],
                    )
            :   undefined;
    }

    private async deleteStaffThreadMessage(thread: Thread, threadMessage: ThreadMessage, channel: SendableChannels) {
        const user = await container.client.users.fetch(thread.idRecipient).catch(() => null);
        const dmCopy = await (
            await user?.createDM()
        )?.messages
            .fetch(threadMessage.idTransferredMessage!)
            .catch(() => null);
        const mirror =
            threadMessage.idMirrorMessage ?
                await channel.messages.fetch(threadMessage.idMirrorMessage).catch(() => null)
            :   null;

        await dmCopy?.delete().catch(() => null);
        await mirror?.delete().catch(() => null);
    }

    private async deleteUserThreadMessage(threadMessage: ThreadMessage, channel: SendableChannels) {
        const copy = await channel.messages.fetch(threadMessage.idTransferredMessage!).catch(() => null);

        await copy?.reply({
            content: '-# 🗑️ Deleted by user',
            allowedMentions: { repliedUser: false },
        });

        await copy?.react('🗑️');
    }

    private async updateUserThreadMessage(threadMessage: ThreadMessageWithThread, content: string) {
        const channel = await getSendableChannel(threadMessage.thread.idChannel);
        const message = await channel?.messages.fetch(threadMessage.idTransferredMessage!).catch(() => null);

        if (!message) {
            return;
        }

        await message.edit({ components: await this.updateComponents(message.components, content) });
    }

    private async updateStaffThreadMessage(threadMessage: ThreadMessageWithThread, contents: string) {
        const staffChannel = await container.threads.getThreadChannel(threadMessage.thread);
        const dmChannel = await (
            await container.client.users.fetch(threadMessage.thread.idRecipient).catch(() => null)
        )?.createDM();
        const mirrorMessage =
            threadMessage.idMirrorMessage ?
                await staffChannel?.messages.fetch(threadMessage.idMirrorMessage).catch(() => null)
            :   null;
        const dmMessage =
            threadMessage.idTransferredMessage ?
                await dmChannel?.messages.fetch(threadMessage.idTransferredMessage).catch(() => null)
            :   null;

        if (mirrorMessage) {
            await mirrorMessage.edit({ components: await this.updateComponents(mirrorMessage.components, contents) });
        }

        if (dmMessage) {
            await dmMessage.edit({ components: await this.updateComponents(dmMessage.components, contents) });
        }
    }

    private async updateComponents(components: TopLevelComponent[], contents: string) {
        const contentsComponent =
            contents.trim().length > 0 ?
                new TextDisplayBuilder().setContent(await replaceEmojis(contents)).setId(COMPONENT_IDS.Content)
            :   null;
        const container = components.find((component) => component.type === ComponentType.Container);
        const newContainer = new ContainerBuilder();
        const displayName = container?.components.find<TextDisplayComponent>(
            (component): component is TextDisplayComponent => component.id === COMPONENT_IDS.DisplayName,
        );
        const separator = container?.components.find<SeparatorComponent>(
            (component): component is SeparatorComponent => component.id === COMPONENT_IDS.Separator,
        );
        const footer = container?.components.find<TextDisplayComponent>(
            (component): component is TextDisplayComponent => component.id === COMPONENT_IDS.Footer,
        );

        newContainer.addTextDisplayComponents(displayName ? [displayName.toJSON()] : []);
        newContainer.addSeparatorComponents(separator ? [separator.toJSON()] : []);
        newContainer.addTextDisplayComponents(contentsComponent ? [contentsComponent] : []);
        newContainer.addTextDisplayComponents(footer ? [footer.toJSON()] : []);

        return [...(newContainer.components.length > 0 ? [newContainer] : []), ...components.slice(container ? 1 : 0)];
    }

    private async postRegularMessage(channel: SendableChannels, message: Message) {
        const guild = await container.settings.getInboxServer();
        const member = message.member ?? (await guild?.members.fetch(message.author.id).catch(() => null));
        const displayName = member?.displayName ?? message.author.displayName;
        const avatar = member?.displayAvatarURL({ size: 64 }) ?? message.author.displayAvatarURL({ size: 64 });

        return channel.send({
            ...(await this.buildMessage(displayName, avatar, message.content, message)),
            allowedMentions: { parse: [] },
        });
    }

    private async postForwardedMessage(channel: SendableChannels, message: Message) {
        return message.forward(channel);
    }
}
