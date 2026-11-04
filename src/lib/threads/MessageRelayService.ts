import type { Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord-api-types/v10';

export class MessageRelayService {
    private static instance: MessageRelayService;

    public constructor() {
        if (MessageRelayService.instance) {
            return MessageRelayService.instance;
        }

        MessageRelayService.instance = this;
    }

    public async messageCreateHandler(message: Message) {
        if (message.guild) {
            void this.guildMessageCreateHandler(message);
        } else {
            void this.directMessageCreateHandler(message);
        }
    }

    private async guildMessageCreateHandler(message: Message) {
        if (message.partial) {
            await message.fetch();
        }

        if (message.webhookId || (message.author.bot && message.flags.has(MessageFlags.IsComponentsV2))) {
            return;
        }

        const thread = await container.threads.getThreadByChannel(message.channelId);

        if (!thread) {
            return;
        }

        await container.threads.saveInternalMessage(thread, message);
    }

    private async directMessageCreateHandler(message: Message) {
        if (!(await this.shouldDMBeRelayed(message))) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        const thread = await container.threads.getOpenThreadOrCreate(message.author, message.author);

        if (!thread) {
            await message.reply(
                'There seems to be a problem and I am unable to relay your message for now. Please try again later.',
            );
            return;
        }

        const justCreated = thread.messages.length < 1 && thread.openedByUser;
        const transferredMessage = await container.threads.sendMessageFromUser(thread, message);

        if (!transferredMessage) {
            await message.reply(
                'There seems to be a problem and I am unable to relay your message for now. Please try again later.',
            );
            return;
        }

        if (justCreated) {
            const newThreadUserMessage = await container.settings.get('new-thread-user-confirm-message');
            const botMember = (await container.settings.getInboxServer())?.members.me;

            if (newThreadUserMessage && botMember) {
                await container.threads.sendMessageFromStaff(thread, newThreadUserMessage, botMember, undefined, true);
            }
        }

        const reaction = await container.settings.get('user-message-reaction');

        if (reaction) {
            await message.react(reaction);
        }
    }

    private async shouldDMBeRelayed(message: Message) {
        return !message.author.bot; // @TODO create a proper condition
    }
}
