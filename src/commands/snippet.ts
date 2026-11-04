import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import {
    addSnippetAlias,
    createSnippet,
    deleteSnippet,
    deleteSnippetAlias,
    editSnippet,
    editSnippetAlias,
    fetchSnippet,
    SNIPPET_CONTENT_MAX_LENGTH,
    SNIPPET_NAME_MAX_LENGTH,
    SNIPPET_NAME_REGEX,
} from '../lib/SnippetService.js';
import {
    type ApplicationCommandOptionChoiceData,
    type ChatInputCommandInteraction,
    ModalBuilder,
    type ModalSubmitInteraction,
    TextInputStyle,
} from 'discord.js';
import { MINUTE } from '../lib/utils/datetime.js';
import { getCommandName } from '../lib/CommandService.js';

export const SNIPPET_CREATE_MODAL_PREFIX: string = 'snippet-create';
export const SNIPPET_EDIT_MODAL_PREFIX: string = 'snippet-edit';

const awaitModalSubmit = async (interaction: ChatInputCommandInteraction, customId: string) =>
    interaction
        .awaitModalSubmit({
            time: 10 * MINUTE,
            filter: (modalInteraction: ModalSubmitInteraction): boolean =>
                modalInteraction.customId === customId && modalInteraction.user.id === interaction.user.id,
        })
        .catch((): null => null);

@ApplyOptions<Subcommand.Options>({
    description: 'Send, create, view, edit and delete snippets',
    subcommands: [
        {
            name: 'send',
            chatInputRun: 'runSend',
        },
        {
            name: 'create',
            chatInputRun: 'runCreate',
        },
        {
            name: 'view',
            chatInputRun: 'runView',
        },
        {
            name: 'edit',
            chatInputRun: 'runEdit',
        },
        {
            name: 'delete',
            chatInputRun: 'runDelete',
        },
        {
            name: 'alias',
            type: 'group',
            entries: [
                {
                    name: 'add',
                    chatInputRun: 'runAliasAdd',
                },
                {
                    name: 'edit',
                    chatInputRun: 'runAliasEdit',
                },
                {
                    name: 'delete',
                    chatInputRun: 'runAliasDelete',
                },
            ],
        },
    ],
})
export default class extends Subcommand {
    public async runSend(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true).toLowerCase();
        const anonymousOverride = interaction.options.getBoolean('anonymous') ?? undefined;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snippet = await fetchSnippet(name);

        if (!snippet) {
            await interaction.editReply('This snippet does not exist.');
            return;
        }

        const thread = await this.container.threads.getThreadByChannel(interaction.channelId);

        if (!thread) {
            await interaction.editReply('This channel does not seem to be a modmail thread.');
            return;
        }

        const staff = await interaction.guild!.members.fetch(interaction.user.id);
        const sent = await this.container.threads.sendMessageFromStaff(
            thread,
            snippet.content,
            staff,
            undefined,
            anonymousOverride,
        );

        if (!sent) {
            await interaction.editReply('Unable to send your message. Make sure the bot is properly configured.');
            return;
        }

        await interaction.deleteReply();
    }

    public async runCreate(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true).toLowerCase();

        if (!SNIPPET_NAME_REGEX.test(name)) {
            await interaction.reply({
                content: 'A snippet name can only contain lowercase letters, numbers, hyphens and underscores.',
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const existingSnippet = await fetchSnippet(name);

        if (existingSnippet) {
            await interaction.reply({
                content: 'A snippet with this name already exists.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const customId: string = `${SNIPPET_CREATE_MODAL_PREFIX}:${name}`;
        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('New snippet')
            .addLabelComponents((label) =>
                label
                    .setLabel('Content')
                    .setTextInputComponent((input) =>
                        input
                            .setCustomId('content')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(SNIPPET_CONTENT_MAX_LENGTH)
                            .setRequired(true),
                    ),
            );

        await interaction.showModal(modal);

        const submit: ModalSubmitInteraction | null = await awaitModalSubmit(interaction, customId);

        if (!submit) {
            return;
        }

        const content = submit.fields.getTextInputValue('content');
        const raced = await fetchSnippet(name);

        if (raced) {
            await submit.reply({ content: 'A snippet with this name already exists.', flags: MessageFlags.Ephemeral });
            return;
        }

        await createSnippet(name, content);

        await submit.reply({
            content: `Done! The snippet \`${name}\` has been created.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    public async runView(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true).toLowerCase();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snippet = await fetchSnippet(name);

        if (!snippet) {
            await interaction.editReply('This snippet does not exist.');
            return;
        }

        await interaction.editReply(snippet.content);
    }

    public async runEdit(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true).toLowerCase();
        const snippet = await fetchSnippet(name);

        if (!snippet) {
            await interaction.reply({
                content: 'This snippet does not exist.',
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const customId: string = `${SNIPPET_EDIT_MODAL_PREFIX}:${name}`;
        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('Edit snippet')
            .addLabelComponents((label) =>
                label
                    .setLabel('Content')
                    .setTextInputComponent((input) =>
                        input
                            .setCustomId('content')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(SNIPPET_CONTENT_MAX_LENGTH)
                            .setValue(snippet.content)
                            .setRequired(false),
                    ),
            );

        await interaction.showModal(modal);

        const submit: ModalSubmitInteraction | null = await awaitModalSubmit(interaction, customId);

        if (!submit) {
            return;
        }

        const content = submit.fields.getTextInputValue('content');
        const raced = (await fetchSnippet(name)) === null;

        if (raced) {
            await submit.reply({
                content: 'The snippet was deleted while you were editing it.',
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (!content.trim()) {
            await submit.reply({
                content: 'You cannot have a snippet with no content.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await editSnippet(snippet.id, content.trim());

        await submit.reply({
            content: `Done! The snippet \`${name}\` has been edited.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    public async runDelete(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true).toLowerCase();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snippet = await fetchSnippet(name);

        if (!snippet) {
            await interaction.editReply('This snippet does not exist.');
            return;
        }

        await deleteSnippet(snippet.id);

        await interaction.editReply(`Done! The snippet \`${name}\` has been deleted.`);
    }

    public async runAliasAdd(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const snippetName = interaction.options.getString('snippet', true);
        const aliasName = interaction.options.getString('name', true).toLowerCase();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!SNIPPET_NAME_REGEX.test(aliasName)) {
            await interaction.editReply(
                'An alias can only contain lowercase letters, numbers, hyphens and underscores.',
            );
            return;
        }

        const existingSnippet = await fetchSnippet(aliasName);

        if (existingSnippet) {
            await interaction.editReply('A snippet already uses this alias.');
            return;
        }

        const isPrimary = interaction.options.getBoolean('primary') ?? false;
        const snippet = await fetchSnippet(snippetName);

        if (!snippet) {
            await interaction.editReply('This snippet does not exist.');
            return;
        }

        await addSnippetAlias(snippet.id, aliasName, isPrimary);

        await interaction.editReply(`Done! The alias \`${aliasName}\` has been added.`);
    }

    public async runAliasEdit(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const aliasName = interaction.options.getString('name', true).toLowerCase();
        const aliasNewName = interaction.options.getString('new-name')?.toLowerCase();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (aliasNewName && !SNIPPET_NAME_REGEX.test(aliasNewName)) {
            await interaction.editReply(
                `An alias can only contain lowercase letters, numbers, hyphens and underscores.`,
            );
            return;
        }

        const existingSnippet = aliasNewName ? await fetchSnippet(aliasNewName) : null;

        if (existingSnippet) {
            await interaction.editReply(`A snippet already uses this alias.`);
            return;
        }

        const isPrimary = interaction.options.getBoolean('primary');

        if (isPrimary === false) {
            await interaction.editReply(`A snippet always needs a primary alias. Promote another one instead.`);
            return;
        }

        const snippet = await fetchSnippet(aliasName);
        const alias = snippet?.aliases.find((alias) => alias.alias.toLowerCase() === aliasName);

        if (!snippet || !alias) {
            await interaction.editReply('This alias does not exist.');
            return;
        }

        await editSnippetAlias(snippet.id, alias.id, aliasNewName ?? aliasName, isPrimary ?? undefined);

        await interaction.editReply(`Done! The alias \`${alias.alias}\` has been updated.`);
    }

    public async runAliasDelete(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const aliasName = interaction.options.getString('name', true).toLowerCase();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snippet = await fetchSnippet(aliasName);
        const alias = snippet?.aliases.find((alias) => alias.alias.toLowerCase() === aliasName);

        if (!snippet || !alias) {
            await interaction.editReply('This alias does not exist.');
            return;
        }

        if (alias.isPrimary) {
            await interaction.editReply("You cannot delete a snippet's primary alias. Promote another one first.");
            return;
        }

        await deleteSnippetAlias(alias.id);

        await interaction.editReply(`Done! The alias \`${alias.alias}\` has been deleted.`);
    }

    public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
        const focusAliases =
            interaction.options.getSubcommandGroup() === 'alias' &&
            ['edit', 'delete'].includes(interaction.options.getSubcommand());
        const option = interaction.options.getFocused(true);
        const trigger = option.value;

        await interaction.respond(
            (
                await this.container.prisma.snippet.findMany({
                    where: {
                        OR: [
                            { aliases: { some: { alias: { contains: trigger } } } },
                            ...(!focusAliases ? [{ content: { contains: trigger } }] : []),
                        ],
                    },
                    include: { aliases: true },
                    take: 25,
                })
            )
                .reduce((carry, snippet) => {
                    if (focusAliases) {
                        carry.push(...snippet.aliases.map((alias) => ({ name: alias.alias, value: alias.alias })));
                        return carry;
                    }

                    const primaryAlias = snippet.aliases.find((alias) => alias.isPrimary)!;
                    const nameStart = `${primaryAlias.alias} - "`;
                    const lengthLeft = 100 - nameStart.length - 1;
                    const content = snippet.content
                        .replace(/\r?\n/gv, ' ')
                        .replace(/<a?(?<code>:[^:]+:)\d+>/gv, '$<code>');
                    const nameEnd =
                        content.length > lengthLeft ? `${content.slice(0, lengthLeft - 1)}…"` : `${content}"`;

                    carry.push({
                        name: `${nameStart}${nameEnd}`,
                        value: primaryAlias.alias,
                    });

                    return carry;
                }, [] as ApplicationCommandOptionChoiceData[])
                .slice(0, 25),
        );
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand((subCommand) =>
                    subCommand
                        .setName('send')
                        .setDescription(`(In a thread) Send a snippet to a modmail thread's recipient`)
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('The name of the snippet you want to send')
                                .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                .setAutocomplete(true)
                                .setRequired(true),
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('anonymous')
                                .setDescription('Whether the snippet should be sent anonymously or not.'),
                        ),
                )
                .addSubcommand((subCommand) =>
                    subCommand
                        .setName('create')
                        .setDescription('Create a snippet')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription(`The new snippet's name`)
                                .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subCommand) =>
                    subCommand
                        .setName('edit')
                        .setDescription('Edit a snippet')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('The name of the snippet you want to edit')
                                .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                .setAutocomplete(true)
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subCommand) =>
                    subCommand
                        .setName('delete')
                        .setDescription('Delete a snippet')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('The name of the snippet you want to delete')
                                .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                .setAutocomplete(true)
                                .setRequired(true),
                        ),
                )
                .addSubcommandGroup((subcommandGroup) =>
                    subcommandGroup
                        .setName('alias')
                        .setDescription(`Manage a snippet's aliases`)
                        .addSubcommand((subcommand) =>
                            subcommand
                                .setName('add')
                                .setDescription('Add an alias to a snippet')
                                .addStringOption((option) =>
                                    option
                                        .setName('snippet')
                                        .setDescription('The snippet to add an alias to')
                                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                        .setAutocomplete(true)
                                        .setRequired(true),
                                )
                                .addStringOption((option) =>
                                    option
                                        .setName('name')
                                        .setDescription('The new alias')
                                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                        .setRequired(true),
                                )
                                .addBooleanOption((option) =>
                                    option
                                        .setName('primary')
                                        .setDescription(`Make this alias the snippet's primary one`),
                                ),
                        )
                        .addSubcommand((subcommand) =>
                            subcommand
                                .setName('edit')
                                .setDescription('Rename an alias or make it primary')
                                .addStringOption((option) =>
                                    option
                                        .setName('name')
                                        .setDescription('The alias to update')
                                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                        .setAutocomplete(true)
                                        .setRequired(true),
                                )
                                .addStringOption((option) =>
                                    option
                                        .setName('new-name')
                                        .setDescription('The new name for this alias')
                                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                        .setRequired(false),
                                )
                                .addBooleanOption((option) =>
                                    option
                                        .setName('primary')
                                        .setDescription(`Make this alias the snippet's primary one`),
                                ),
                        )
                        .addSubcommand((subcommand) =>
                            subcommand
                                .setName('delete')
                                .setDescription('Delete an alias from a snippet')
                                .addStringOption((option) =>
                                    option
                                        .setName('name')
                                        .setDescription('The alias to delete')
                                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                                        .setAutocomplete(true)
                                        .setRequired(true),
                                ),
                        ),
                ),
        );
    }
}
