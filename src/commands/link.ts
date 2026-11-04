import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType, PermissionFlagsBits } from 'discord-api-types/v10';
import type { Message } from 'discord.js';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Get the URL to the transcript',
    aliases: ['url', 'loglink', 'logurl', 'log-link', 'log-url'],
})
export class LinkCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const thread = await this.container.threads.getThreadByChannel(interaction.channelId);

        if (!thread) {
            await interaction.editReply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        await interaction.editReply(
            `This thread's transcript can be found at: ${this.container.web.url(`/thread/${thread.id}`)}`,
        );
    }

    public override async messageRun(message: Message) {
        const thread = await this.container.threads.getThreadByChannel(message.channelId);

        if (!thread) {
            await message.reply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        await message.reply(
            `This thread's transcript can be found at: ${this.container.web.url(`/thread/${thread.id}`)}`,
        );
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
