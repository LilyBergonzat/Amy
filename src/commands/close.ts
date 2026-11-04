import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import { InteractionContextType, PermissionFlagsBits } from 'discord-api-types/v10';
import { stringToDuration } from '../lib/utils/datetime.js';
import type { Message } from 'discord.js';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Close the current thread',
    aliases: ['c'],
    options: ['delay'],
})
export class CloseCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const delay = interaction.options.getString('delay');
        const duration = stringToDuration(delay);

        if (delay && duration === null) {
            await interaction.reply({ content: 'The duration you entered seems to be invalid.' });
            return;
        }

        await interaction.deferReply();

        const thread = await this.container.threads.getThreadByChannel(interaction.channelId);

        if (!thread) {
            await interaction.editReply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        if (!duration) {
            await interaction.editReply({ content: 'Closing thread...' });
        }

        await this.container.threads.closeThread(thread, duration);

        if (duration) {
            await interaction.editReply({ content: `Thread scheduled to be closed in ${delay}` });
        }
    }

    public override async messageRun(message: Message, args: Args) {
        const delay = await args.pick('string').catch(() => null);
        const duration = stringToDuration(delay);

        if (delay && duration === null) {
            await message.reply({ content: 'The duration you entered seems to be invalid.' });
            return;
        }

        const thread = await this.container.threads.getThreadByChannel(message.channelId);

        if (!thread) {
            await message.reply({ content: 'This channel does not seem to be a modmail thread.' });
            return;
        }

        if (!duration) {
            await message.reply({ content: 'Closing thread...' });
        }

        await this.container.threads.closeThread(thread, duration);

        if (duration) {
            await message.reply({ content: `Thread scheduled to be closed in ${delay}` });
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addStringOption((option) => option.setName('delay').setDescription('Close after a delay (i.e. "3h")')),
        );
    }
}
