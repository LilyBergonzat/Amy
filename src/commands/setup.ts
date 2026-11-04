import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ButtonStyle, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { WizardService } from '../lib/WizardService.js';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: 'The first command to run after inviting the bot to your server',
})
export class SetupCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const currentGuildId = await this.container.settings.get('inbox-server');

        if (currentGuildId && currentGuildId !== interaction.guildId) {
            await interaction.reply({
                ...WizardService.buildStepData(
                    'Forbidden',
                    'This bot is already configured for another server. You cannot also configure it here.',
                    'https://img.icons8.com/clouds/85/error.png',
                ),
                flags: MessageFlags.IsComponentsV2,
            });

            return;
        }

        const introMessageData = WizardService.buildStepData(
            'Setup',
            `Thank you for installing Amy. Amy is a modmail bot, which means its goal is to be the relay between the members and the moderation team.

In order for this bot to work correctly, you need to setup a few things. Don't worry, it will be quick: **only 4 steps**!`,
            'https://img.icons8.com/clouds/85/message-settings.png',
        );

        await interaction.reply({
            ...introMessageData,
            flags: MessageFlags.IsComponentsV2,
            components: [
                ...introMessageData.components,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            customId: WizardService.buildId({ controller: 'setup' }),
                            emoji: '🧭',
                            style: ButtonStyle.Success,
                            label: 'Start!',
                        }),
                    ],
                }),
            ],
        });
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
