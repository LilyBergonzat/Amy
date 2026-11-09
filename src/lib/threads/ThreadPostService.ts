import { type Thread, type ThreadMessage, ThreadOpen } from '../../generated/prisma/client.js';
import {
    type ComponentInContainer,
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
    SeparatorSpacingSize,
    TextChannel,
    TextDisplayBuilder,
    type TopLevelComponent,
    type Webhook,
} from 'discord.js';
import { container } from '@sapphire/framework';
import {
    getSendableChannel,
    isGalleryMedia,
    isNotGalleryMedia,
    type StickerMedia,
    stickerMedia,
} from '../utils/discord.js';
import type { Optional } from '@prisma/client/runtime/client';
import type { ThreadMessageWithThread } from './ThreadService.js';
import { ComponentType } from 'discord-api-types/v10';

export class ThreadPostService {
    private static instance: ThreadPostService;

    public constructor() {
        if (ThreadPostService.instance) {
            return ThreadPostService.instance;
        }

        ThreadPostService.instance = this;
    }

    public async postUserMessage(thread: Thread, message: Message) {
        const webhook = await this.getThreadWebhook(thread);

        if (!webhook) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        return message.reference?.type === MessageReferenceType.Forward ?
                this.postForwardedMessage(webhook, message)
            :   this.postRegularMessage(webhook, message);
    }

    public async postStaffMessage(
        thread: Thread,
        contents: string | null,
        staff: GuildMember,
        message?: Message,
        anonymousOverride?: boolean,
    ) {
        const user = await container.client.users.fetch(thread.idRecipient).catch(() => null);

        if (!user) {
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

        const media = message ? [...message.attachments.values()].filter(isGalleryMedia) : [];
        const files = message ? [...message.attachments.values()].filter(isNotGalleryMedia) : [];
        const stickers: StickerMedia[] =
            message ?
                (await Promise.all([...message.stickers.values()].map(stickerMedia))).filter(
                    (sticker) => sticker !== null,
                )
            :   [];

        const data: MessageCreateOptions = {
            flags: MessageFlags.IsComponentsV2,
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents([new TextDisplayBuilder().setContent(`**${displayName}**`)])
                    .addSeparatorComponents([
                        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
                    ])
                    .addTextDisplayComponents(contents ? [new TextDisplayBuilder().setContent(contents)] : []),
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

        const sentMessage = await user.send(data);
        const mirrorMessage = await channel.send(data).catch((error) => container.logger.error(error));

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
        const webhook = await this.getThreadWebhook(threadMessage.thread);
        const message = await webhook?.fetchMessage(threadMessage.idTransferredMessage!).catch(() => null);

        if (!message) {
            return;
        }

        await webhook?.editMessage(message.id, { content });
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

        const contentsComponent = new TextDisplayBuilder().setContent(contents) as unknown as ComponentInContainer;
        const updateComponents = (components: TopLevelComponent[]) => {
            const container = components.find((component) => component.type === ComponentType.Container);

            if (container) {
                if (container.components.length > 2) {
                    container.components[2] = contentsComponent;
                } else {
                    container.components.push(contentsComponent);
                }
            }

            return [...(container ? [container] : []), ...components.slice(1)];
        };

        if (mirrorMessage) {
            await mirrorMessage.edit({ components: updateComponents(mirrorMessage.components) });
        }

        if (dmMessage) {
            await dmMessage.edit({ components: updateComponents(dmMessage.components) });
        }
    }

    private async getThreadWebhook(thread: Thread) {
        const channel = await getSendableChannel(thread.idChannel);

        if (!channel) {
            return;
        }

        const webhooks = await channel.guild.fetchWebhooks();
        const webhook = webhooks.find(
            (webhook) => webhook.channelId === channel.id && webhook.owner?.id === container.client.user!.id,
        );

        if (webhook) {
            return webhook;
        }

        const recipient = await channel.guild.members.fetch(thread.idRecipient);

        if (!recipient) {
            return;
        }

        return (channel as TextChannel).createWebhook({
            name: recipient.displayName,
            avatar: recipient.displayAvatarURL({ size: 2048 }),
        });
    }

    private async postRegularMessage(webhook: Webhook, message: Message) {
        const stickers = (await Promise.all([...message.stickers.values()].map(stickerMedia))).filter(
            (sticker) => sticker !== null,
        );

        const messageData: Optional<Message> = Object.assign({}, message);

        delete messageData.nonce;

        return webhook.send({
            ...messageData,
            files: [
                ...message.attachments.values(),
                ...stickers.map((stickerMedia) =>
                    stickerMedia.isConverted ?
                        stickerMedia.file
                    :   {
                            name: `${stickerMedia.name}.png`,
                            attachment: stickerMedia.url,
                            description: stickerMedia.description,
                        },
                ),
            ],
            flags: message.flags.bitfield,
            poll: undefined,
            allowedMentions: { parse: [] },
        });
    }

    private async postForwardedMessage(webhook: Webhook, message: Message) {
        return message.forward(webhook.channel as TextChannel);
    }
}
