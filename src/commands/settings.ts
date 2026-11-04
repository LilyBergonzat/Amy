import { ApplyOptions } from '@sapphire/decorators';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import {
    addSettingsOptions,
    formatSettingForMessage,
    type Key,
    requiredSettings,
    sanitizeSettingValue,
    settingKeys,
    settingNames,
    validateSettingValue,
} from '../lib/SettingsService.js';
import { Subcommand, type SubcommandMappingArray } from '@sapphire/plugin-subcommands';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Subcommand.Options>({
    description: `Manage this bot's settings`,
})
export class SettingsCommand extends Subcommand {
    public subcommandMappings: SubcommandMappingArray = [
        {
            type: 'method',
            name: 'set',
            chatInputRun: 'setSubcommand',
        },
        {
            type: 'method',
            name: 'view',
            chatInputRun: 'viewSubcommand',
        },
        {
            type: 'method',
            name: 'unset',
            chatInputRun: 'unsetSubcommand',
        },
    ];

    public async setSubcommand(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const set = [];
        const errors = [];

        for (const key of settingKeys) {
            const value = interaction.options.getString(key);

            if (value === null) {
                continue;
            }

            const sanitizedValue = sanitizeSettingValue(key, value);

            if (!(await validateSettingValue(key, sanitizedValue))) {
                errors.push(key);
                continue;
            }

            await this.container.settings.set(key, sanitizedValue);
            set.push(key);
        }

        const errorsMention =
            errors.length > 0 ?
                `⚠️ The following setting${errors.length > 2 ? 's' : ''} could not be saved: ${errors.join(', ')}\n`
            :   '';

        await interaction.editReply(
            `${errorsMention}The setting${set.length > 1 ? 's' : ''} ${set.map((s) => `"${s}"`).join(', ')} ${set.length > 1 ? 'have' : 'has'} been set.`,
        );
    }

    public async viewSubcommand(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = interaction.options.getString('key') as Key | null;

        if (key) {
            await interaction.editReply(
                `**${settingNames[key]}:** ${formatSettingForMessage(key, await this.container.settings.get(key))}`,
            );
            return;
        }

        const settings = await this.container.settings.getAllRaw();

        if (Object.keys(settings).length < 1) {
            await interaction.editReply('No saved settings yet.');
            return;
        }

        await interaction.editReply(
            Object.keys(settings)
                .map(
                    (key) =>
                        `- **${settingNames[key as Key]}:** ${formatSettingForMessage(key as Key, settings[key as Key])}`,
                )
                .join('\n'),
        );
    }

    public async unsetSubcommand(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = interaction.options.getString('key', true);

        await this.container.settings.unset(key as Key);

        await interaction.editReply(`The setting ${key} has been unset.`);
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand((subcommand) =>
                    addSettingsOptions(subcommand.setName('set').setDescription(`To change settings' value`)),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('view')
                        .setDescription(`To view the current settings`)
                        .addStringOption((option) =>
                            option
                                .setName('key')
                                .setDescription('The setting to view the value of')
                                .setChoices(settingKeys.map((key) => ({ name: key, value: key }))),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('unset')
                        .setDescription(`To change settings' value`)
                        .addStringOption((option) =>
                            option
                                .setName('key')
                                .setDescription('The setting to unset')
                                .setChoices(
                                    settingKeys
                                        .filter((key) => !requiredSettings.includes(key))
                                        .map((key) => ({ name: key, value: key })),
                                )
                                .setRequired(true),
                        ),
                ),
        );
    }
}
