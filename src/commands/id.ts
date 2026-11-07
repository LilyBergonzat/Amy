import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType, PermissionFlagsBits } from 'discord-api-types/v10';
import type { Message } from 'discord.js';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Get the ID of the recipient member',
})
export class IdCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const thread = await this.container.threads.getThreadByChannel(interaction.channelId);

        if (!thread) {
            await interaction.editReply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        await interaction.editReply(thread.idRecipient);
    }

    public override async messageRun(message: Message) {
        const thread = await this.container.threads.getThreadByChannel(message.channelId);

        if (!thread) {
            await message.reply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        await message.reply(thread.idRecipient);
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        );
    }
}
