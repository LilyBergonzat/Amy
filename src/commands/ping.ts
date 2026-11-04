import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType, PermissionFlagsBits } from 'discord-api-types/v10';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: 'Tests the latency',
})
export class PingCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.reply({ content: 'Ping...' });
        const response = await interaction.fetchReply();
        const latency = response.createdTimestamp - interaction.createdTimestamp;

        await interaction.editReply(`Pong! Took me ${latency}ms.`);
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .setContexts(InteractionContextType.Guild),
        );
    }
}
