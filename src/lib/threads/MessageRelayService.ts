import { type Message, MessageReferenceType } from 'discord.js';
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
            await this.guildMessageCreateHandler(message);
        } else {
            await this.directMessageCreateHandler(message);
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

        await this.highlightSnowflakes(message, transferredMessage);
    }

    private async shouldDMBeRelayed(message: Message) {
        return !message.author.bot; // @TODO create a proper condition
    }

    private async highlightSnowflakes(message: Message, transferredMessage: Message) {
        const content =
            message.reference?.type === MessageReferenceType.Forward ?
                message.messageSnapshots.first()?.content
            :   message.content;

        if (!content) {
            return;
        }

        const regex = /(?<![\d:])(?<snowflake>\d{17,20})(?![\d>])/gv;
        const snowflakes = new Set<string>();
        let matches;

        do {
            matches = regex.exec(content);
            matches?.groups?.snowflake && snowflakes.add(matches.groups.snowflake);
        } while (matches);

        if (snowflakes.size < 1) {
            return;
        }

        await transferredMessage.reply(
            `-# IDs in this message:\n${[...snowflakes].map((s) => `-# - \`${s}\``).join('\n')}`,
        );
    }
}
