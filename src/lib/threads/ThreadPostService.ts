import type { Thread } from '../../generated/prisma/client.js';
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
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextChannel,
    TextDisplayBuilder,
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
            return;
        }

        if (message && message.partial) {
            await message.fetch();
        }

        const channel = await container.threads.getThreadChannel(thread);

        if (!channel) {
            return;
        }

        const displayName = await container.settings.getStaffDisplayName(staff, anonymousOverride);

        if (!displayName) {
            return;
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

        await channel.send(data).catch(console.error);

        return sentMessage;
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
