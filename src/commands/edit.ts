import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import {
    ApplicationCommandType,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord-api-types/v10';
import type { Message, SendableChannels, TextBasedChannel } from 'discord.js';
import { getCommandName, isCommandEnabled } from '../lib/CommandService.js';
import type { ThreadMessageWithThread } from '../lib/threads/ThreadService.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Edit a staff reply',
    aliases: ['e'],
})
export class EditCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const messageInput = interaction.options.getString('message', true);
        const matches = /(?<id>\d{17,20})$/v.exec(messageInput);

        if (!matches || !matches.groups?.id) {
            await interaction.reply({
                content: 'The message ID or URL you entered seems to be invalid.',
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await this.interactionRun(
            matches.groups.id,
            interaction.channel,
            interaction.editReply.bind(interaction),
            (content: string) => interaction.followUp({ content, flags: MessageFlags.Ephemeral }),
        );
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await this.interactionRun(
            interaction.targetId,
            interaction.channel,
            interaction.editReply.bind(interaction),
            (content: string) => interaction.followUp({ content, flags: MessageFlags.Ephemeral }),
        );
    }

    public override async messageRun(message: Message, args: Args) {
        const messageInput = await args.pick('string').catch(() => null);
        const matches = messageInput ? /(?<id>\d{17,20})$/v.exec(messageInput) : null;

        if (!matches || !matches.groups?.id) {
            await message.reply('The message ID or URL you entered seems to be invalid.');
            return;
        }

        const [targetMessage, threadMessage] = await this.getMessageData(
            matches.groups.id,
            message.channel,
            message.reply.bind(message),
        );
        const newContent = await args.rest('string').catch(() => null);

        if (!targetMessage || !threadMessage) {
            return;
        }

        if (!newContent) {
            await message.reply('You have to enter a new content for the reply.');
            return;
        }

        if (newContent === threadMessage.contents) {
            await message.reply('The new content you entered is the same as the current content.');
            return;
        }

        await this.container.threads.updateThreadMessage(threadMessage, newContent, message.author.id);
        await message.delete();

        await (message.channel as SendableChannels).send({
            content: `${message.author} has edited message ${targetMessage.url}.`,
            allowedMentions: { parse: [] },
        });
    }

    private async interactionRun(
        id: string,
        channel: TextBasedChannel | null,
        reply: (content: string) => Promise<Message>,
        followUp: (content: string) => Promise<Message>,
    ) {
        const [message, threadMessage] = await this.getMessageData(id, channel, reply);

        if (!message || !threadMessage) {
            return;
        }

        const replyStart = 'Here is the command you can copy, paste then modify and send to edit this reply:';
        const commandStart = `${await this.container.settings.getPrefix()}${this.name} ${id} `;
        const commandText =
            replyStart.length + threadMessage.contents.length + commandStart.length + 7 < 2000 ?
                threadMessage.contents
            :   'Type your edited reply here.';

        if (commandText.includes('```')) {
            await reply(replyStart);
            await followUp(`${commandStart}${commandText}`);
        } else {
            await reply(`${replyStart}\n\`\`\`${commandStart}${commandText}\`\`\``);
        }
    }

    private async getMessageData(
        id: string,
        channel: TextBasedChannel | null,
        reply: (content: string) => Promise<Message>,
    ): Promise<[Message, ThreadMessageWithThread] | []> {
        const message = await channel?.messages.fetch(id).catch(() => null);

        if (!message) {
            await reply('Unable to retrieve the specified message in this channel.');
            return [];
        }

        const thread = await this.container.threads.getThreadByChannel(channel!.id);
        const threadMessage = await this.container.threads.getThreadMessageFromMessage(message.id, true);

        if (!thread) {
            await reply('This channel does not seem to be a modmail thread.');
            return [];
        }

        if (!threadMessage || threadMessage.thread.id !== thread.id) {
            await reply('The message you are trying to edit does not seem to be from this thread.');
            return [];
        }

        if (!threadMessage.idStaff || threadMessage.internal) {
            await reply('You can only use this command with replies sent to the user.');
            return [];
        }

        return [message, threadMessage];
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addStringOption((option) =>
                    option.setName('message').setDescription('The ID or URL of the message to edit').setRequired(true),
                ),
        );

        if (isCommandEnabled('edit')) {
            registry.registerContextMenuCommand((builder) =>
                builder
                    .setName('Edit reply')
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                    .setType(ApplicationCommandType.Message),
            );
        }
    }
}
