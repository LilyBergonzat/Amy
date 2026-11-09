import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import {
    ApplicationCommandType,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord-api-types/v10';
import type { Message, TextBasedChannel } from 'discord.js';
import { getCommandName, isCommandEnabled } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Delete a staff reply',
    aliases: ['d'],
})
export class DeleteCommand extends Command {
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
        await this.execute(matches.groups.id, interaction.channel, interaction.editReply.bind(interaction));
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await this.execute(interaction.targetId, interaction.channel, interaction.editReply.bind(interaction));
    }

    public override async messageRun(message: Message, args: Args) {
        const messageInput = await args.pick('string').catch(() => null);
        const matches = messageInput ? /(?<id>\d{17,20})$/v.exec(messageInput) : null;

        if (!matches || !matches.groups?.id) {
            await message.reply('The message ID or URL you entered seems to be invalid.');
            return;
        }

        await this.execute(matches.groups.id, message.channel, message.reply.bind(message));
    }

    private async execute(id: string, channel: TextBasedChannel | null, reply: (content: string) => Promise<Message>) {
        const message = await channel?.messages.fetch(id).catch(() => null);

        if (!message) {
            await reply('Unable to retrieve the specified message in this channel.');
            return;
        }

        const thread = await this.container.threads.getThreadByChannel(channel!.id);
        const threadMessage = await this.container.threads.getThreadMessageFromMessage(message.id, true);

        if (!thread) {
            await reply('This channel does not seem to be a modmail thread.');
            return;
        }

        if (!threadMessage || threadMessage.thread.id !== thread.id) {
            await reply('The message you are trying to delete does not seem to be from this thread.');
            return;
        }

        if (!threadMessage.idStaff || threadMessage.internal) {
            await reply('You can only use this command with replies sent to the user.');
            return;
        }

        await this.container.threads.deleteThreadMessage(threadMessage);

        await reply(`Reply deleted!`);
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('The ID or URL of the message to delete')
                        .setRequired(true),
                ),
        );

        if (isCommandEnabled('delete')) {
            registry.registerContextMenuCommand((builder) =>
                builder
                    .setName('Delete reply')
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                    .setType(ApplicationCommandType.Message),
            );
        }
    }
}
