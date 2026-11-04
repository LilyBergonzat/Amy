import { type InteractionWithCustomId, WizardService } from '../WizardService.js';
import {
    ButtonStyle,
    ChannelType,
    ComponentType,
    MessageFlags,
    SelectMenuDefaultValueType,
} from 'discord-api-types/v10';
import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    type InteractionReplyOptions,
    LabelBuilder,
    type Message,
    ModalBuilder,
    type ModalSubmitInteraction,
    TextInputStyle,
} from 'discord.js';
import { getCommandMention } from '../utils/mention.js';
import { container } from '@sapphire/framework';
import { formatSettingForMessage, type Key, settingNames, validateSettingValue } from '../SettingsService.js';
import { WizardController } from '../WizardController.js';

const CUSTOM_IDS = {
    TextInputPrefix: 'text_input_prefix',
    SelectInboxCategory: 'select_inbox_category',
    SelectLogChannel: 'select_log_channel',
    CheckboxAnonymousDefault: 'checkbox_anonymous_default',
    TextInputAnonymousName: 'text_input_anonymous_name',
    SelectNewThreadPing: 'select_new_thread_ping',
    TextInputNewThreadStaffMessage: 'text_input_new_thread_staff_message',
    TextInputNewThreadUserMessage: 'text_input_new_thread_user_message',
    TextInputUserMessageReaction: 'text_input_user_message_reaction',
} as const satisfies Record<string, string>;

export default class extends WizardController {
    public async index(interaction: InteractionWithCustomId) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message = await WizardService.getOriginalMessage(interaction, true);
        await container.settings.set('inbox-server', interaction.guildId!);

        const prefixStepMessageData = WizardService.buildStepData(
            'Prefix',
            'This bot uses both slash commands and message commands. What do you want the prefix to be for message commands?',
            'https://img.icons8.com/clouds/85/edit.png',
        );

        await message.edit({
            ...prefixStepMessageData,
            components: [
                ...prefixStepMessageData.components,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            customId: WizardService.buildId({ controller: 'setup', action: 'prefixHelp' }),
                            emoji: '❔',
                            style: ButtonStyle.Secondary,
                            label: `What's a prefix?`,
                        }),
                        new ButtonBuilder({
                            customId: WizardService.buildId({ controller: 'setup', action: 'prefixSetModalShow' }),
                            emoji: '✏️',
                            style: ButtonStyle.Primary,
                            label: `Set a prefix!`,
                        }),
                    ],
                }),
            ],
        });

        await interaction.deleteReply();
    }

    public async prefixHelp(interaction: InteractionWithCustomId) {
        return interaction.reply({
            content: `Since you're here, you know what a slash command is: ${getCommandMention('setup')} is one! A message command is similar: it's a command but takes the form of a message.

For the bot to be able to differentiate between regular messages (people chatting together, for example) and a command, we use a **prefix**. It's a character that you add before a command name in a message. For example, if you want to use a command named "reply" and your prefix is "!", you would type \`!reply\``,
            flags: MessageFlags.Ephemeral,
        });
    }

    public async prefixSetModalShow(interaction: ButtonInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const currentPrefix = await container.settings.get('prefix');
        const modal = new ModalBuilder({
            customId: WizardService.buildId({ controller: 'setup', action: 'prefixSetModalSubmit' }),
            title: 'Prefix',
            components: [
                new LabelBuilder({
                    label: 'Prefix',
                    description: 'Most people pick "!" or "." as their prefix.',
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: CUSTOM_IDS.TextInputPrefix,
                        style: TextInputStyle.Short,
                        value: currentPrefix ?? undefined,
                        required: true,
                    },
                }),
            ],
        });

        await interaction.showModal(modal);
    }

    public async prefixSetModalSubmit(interaction: ModalSubmitInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const message = await WizardService.getOriginalMessage(interaction, true);
        const prefix = interaction.fields.getTextInputValue(CUSTOM_IDS.TextInputPrefix).trim();

        const valid = (await Promise.all([await validateSettingValue('prefix', prefix)])).every(Boolean);

        if (!valid) {
            await interaction.reply(this.#getInvalidValueMessageData());
            return;
        }

        await container.settings.set('prefix', prefix);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const nextStepData = WizardService.buildStepData(
            'Channels',
            'New DMs to the bot will create **conversation threads** in this server in the form of **text channels**. When a conversation is over and closed, a **transcript** is sent to a **log channel**.',
            'https://img.icons8.com/clouds/85/full-mailbox.png',
        );

        await message.edit({
            ...nextStepData,
            components: [
                ...nextStepData.components,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            customId: WizardService.buildId({ controller: 'setup', action: 'channelSetModalShow' }),
                            style: ButtonStyle.Success,
                            emoji: '📩',
                            label: 'Select channels!',
                        }),
                    ],
                }),
            ],
        });

        await interaction.deleteReply();
    }

    public async channelSetModalShow(interaction: ButtonInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const currentInboxCategory = await container.settings.get('inbox-category');
        const currentLogChannel = await container.settings.get('log-channel');

        const modal = new ModalBuilder({
            customId: WizardService.buildId({ controller: 'setup', action: 'channelSetModalSubmit' }),
            title: 'Threads Configuration',
            components: [
                new LabelBuilder({
                    label: 'Inbox Category',
                    description: 'What channel category should new threads be created in?',
                    component: {
                        type: ComponentType.ChannelSelect,
                        custom_id: CUSTOM_IDS.SelectInboxCategory,
                        channel_types: [ChannelType.GuildCategory],
                        max_values: 1,
                        default_values:
                            currentInboxCategory ?
                                [{ type: SelectMenuDefaultValueType.Channel, id: currentInboxCategory }]
                            :   undefined,
                        required: true,
                    },
                }),
                new LabelBuilder({
                    label: 'Log Channel',
                    description: 'What channel should transcripts of closed threads be posted in?',
                    component: {
                        type: ComponentType.ChannelSelect,
                        custom_id: CUSTOM_IDS.SelectLogChannel,
                        channel_types: [ChannelType.GuildText],
                        max_values: 1,
                        default_values:
                            currentLogChannel ?
                                [{ type: SelectMenuDefaultValueType.Channel, id: currentLogChannel }]
                            :   undefined,
                        required: true,
                    },
                }),
            ],
        });

        await interaction.showModal(modal);
    }

    public async channelSetModalSubmit(interaction: ModalSubmitInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const message = await WizardService.getOriginalMessage(interaction, true);
        const inboxCategory = interaction.fields.getSelectedChannels(CUSTOM_IDS.SelectInboxCategory);
        const logChannel = interaction.fields.getSelectedChannels(CUSTOM_IDS.SelectLogChannel);

        const valid = (
            await Promise.all([
                await validateSettingValue('log-channel', logChannel?.first()?.id ?? null),
                await validateSettingValue('inbox-category', inboxCategory?.first()?.id ?? null),
            ])
        ).every(Boolean);

        if (!valid) {
            await interaction.reply(this.#getInvalidValueMessageData());
            return;
        }

        await container.settings.set('log-channel', logChannel!.first()!.id);
        await container.settings.set('inbox-category', inboxCategory!.first()!.id);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const nextStepData = WizardService.buildStepData(
            'Post As',
            `When sending messages to the members of your server, would you want these messages to be shown as being sent by the specific moderator who sent it, or would you want a united identity, like for example "Staff Team"?\n\nWhat you're picking here is only the **default** behaviour. No matter what you choose, it will always be possible to do otherwise upon actually sending a message through the bot.`,
            'https://img.icons8.com/clouds/85/employee-card.png',
        );

        await message.edit({
            ...nextStepData,
            components: [
                ...nextStepData.components,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            customId: WizardService.buildId({ controller: 'setup', action: 'identitySetModalShow' }),
                            style: ButtonStyle.Success,
                            emoji: '🪪',
                            label: 'Pick an identity!',
                        }),
                    ],
                }),
            ],
        });

        await interaction.deleteReply();
    }

    public async identitySetModalShow(interaction: ButtonInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const currentDefaultAnonymous = await container.settings.get('anonymous-by-default');
        const currentAnonymousName = await container.settings.get('anonymous-display-name');

        const anonymousSetModal = new ModalBuilder({
            customId: WizardService.buildId({ controller: 'setup', action: 'identitySetModalSubmit' }),
            title: 'Identity Configuration',
            components: [
                new LabelBuilder({
                    label: 'Unified Identity By Default',
                    description: 'Do you want to send messages as a unified identity by default?',
                    component: {
                        type: ComponentType.Checkbox,
                        custom_id: CUSTOM_IDS.CheckboxAnonymousDefault,
                        default: Boolean(currentDefaultAnonymous),
                    },
                }),
                new LabelBuilder({
                    label: 'Unified Identity Name',
                    description: 'If you were to send a message as a unified identity, what would be its name?',
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: CUSTOM_IDS.TextInputAnonymousName,
                        style: TextInputStyle.Short,
                        value: currentAnonymousName ?? undefined,
                        required: false,
                    },
                }),
            ],
        });

        await interaction.showModal(anonymousSetModal);
    }

    public async identitySetModalSubmit(interaction: ModalSubmitInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const message = await WizardService.getOriginalMessage(interaction, true);
        const anonymousDefault = Boolean(interaction.fields.getCheckbox(CUSTOM_IDS.CheckboxAnonymousDefault));
        const anonymousName = interaction.fields.getTextInputValue(CUSTOM_IDS.TextInputAnonymousName).trim();

        const valid = (
            await Promise.all([
                await validateSettingValue('anonymous-by-default', anonymousDefault),
                await validateSettingValue(
                    'anonymous-display-name',
                    anonymousName === '' ? 'Staff Team' : anonymousName,
                ),
            ])
        ).every(Boolean);

        if (!valid) {
            await interaction.reply(this.#getInvalidValueMessageData());
            return;
        }

        await container.settings.set('anonymous-by-default', anonymousDefault);
        await container.settings.set('anonymous-display-name', anonymousName === '' ? 'Staff Team' : anonymousName);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const nextStepData = WizardService.buildStepData(
            'Conversation Behaviour',
            `When a new conversation starts, so when a new thread is created, a few things happen.\n- If the conversation was started by the user, the bot will **send a message to the user**, usually to confirm that the message was transferred to the mods.\n- On the staff side, the bot can **ping a role** and **send a message**\n\nMoreover, every time the bot relays a message from a user, it reacts to that message to show the user that it was successfully sent.`,
            'https://img.icons8.com/clouds/85/employee-card.png',
        );

        await message.edit({
            ...nextStepData,
            components: [
                ...nextStepData.components,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            customId: WizardService.buildId({
                                controller: 'setup',
                                action: 'conversationSetModalShow',
                            }),
                            style: ButtonStyle.Success,
                            emoji: '🪪',
                            label: 'Fine-tune the behaviour!',
                        }),
                    ],
                }),
            ],
        });

        await interaction.deleteReply();
    }

    public async conversationSetModalShow(interaction: ButtonInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const currentRolePing = await container.settings.get('new-thread-ping');
        const currentStaffMessage = await container.settings.get('new-thread-message');
        const currentUserMessage = await container.settings.get('new-thread-user-confirm-message');
        const currentUserMessageReaction = await container.settings.get('user-message-reaction');

        const anonymousSetModal = new ModalBuilder({
            customId: WizardService.buildId({ controller: 'setup', action: 'conversationSetModalSubmit' }),
            title: 'Conversation Behaviour',
            components: [
                new LabelBuilder({
                    label: 'New Thread Ping',
                    description: 'What role should be pinged whenever a member starts a new conversation?',
                    component: {
                        type: ComponentType.RoleSelect,
                        custom_id: CUSTOM_IDS.SelectNewThreadPing,
                        max_values: 1,
                        default_values:
                            currentRolePing ?
                                [{ type: SelectMenuDefaultValueType.Role, id: currentRolePing }]
                            :   undefined,
                        required: false,
                    },
                }),
                new LabelBuilder({
                    label: 'New Thread Staff Message',
                    description: 'What message should be posted for the staff at the start of a new conversation?',
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: CUSTOM_IDS.TextInputNewThreadStaffMessage,
                        style: TextInputStyle.Paragraph,
                        value: currentStaffMessage ?? undefined,
                        required: false,
                    },
                }),
                new LabelBuilder({
                    label: 'New Thread User Message',
                    description: 'What message should be replied to users who start a new conversation themselves?',
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: CUSTOM_IDS.TextInputNewThreadUserMessage,
                        style: TextInputStyle.Paragraph,
                        value: currentUserMessage ?? undefined,
                        required: false,
                    },
                }),
                new LabelBuilder({
                    label: 'User Message Reaction',
                    description: 'What reaction should be used to show the user that their message was sent?',
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: CUSTOM_IDS.TextInputUserMessageReaction,
                        style: TextInputStyle.Short,
                        value: currentUserMessageReaction ?? '📨',
                        required: true,
                    },
                }),
            ],
        });

        await interaction.showModal(anonymousSetModal);
    }

    public async conversationSetModalSubmit(interaction: ModalSubmitInteraction) {
        if (!(await WizardService.ensureAllowedUser(interaction))) {
            return;
        }

        const message = await WizardService.getOriginalMessage(interaction, true);
        const newThreadPing = interaction.fields.getSelectedRoles(CUSTOM_IDS.SelectNewThreadPing);
        const newThreadStaffMessage = interaction.fields
            .getTextInputValue(CUSTOM_IDS.TextInputNewThreadStaffMessage)
            .trim();
        const newThreadUserMessage = interaction.fields
            .getTextInputValue(CUSTOM_IDS.TextInputNewThreadUserMessage)
            .trim();
        const userMessageReaction = interaction.fields
            .getTextInputValue(CUSTOM_IDS.TextInputUserMessageReaction)
            .trim();

        const savedNewThreadPing = newThreadPing && newThreadPing.size > 0 ? newThreadPing.first()!.id : null;
        const savedNewThreadStaffMessage = newThreadStaffMessage === '' ? null : newThreadStaffMessage;
        const savedNewThreadUserMessage = newThreadUserMessage === '' ? null : newThreadUserMessage;
        const savedUserMessageReaction = userMessageReaction === '' ? null : userMessageReaction;
        const valid = (
            await Promise.all([
                await validateSettingValue('new-thread-ping', savedNewThreadPing),
                await validateSettingValue('new-thread-message', savedNewThreadStaffMessage),
                await validateSettingValue('new-thread-user-confirm-message', savedNewThreadUserMessage),
                await validateSettingValue('user-message-reaction', savedUserMessageReaction),
            ])
        ).every(Boolean);

        if (!valid) {
            await interaction.reply(this.#getInvalidValueMessageData());
            return;
        }

        savedNewThreadPing ?
            await container.settings.set('new-thread-ping', savedNewThreadPing)
        :   await container.settings.unset('new-thread-ping');

        savedNewThreadStaffMessage ?
            await container.settings.set('new-thread-message', savedNewThreadStaffMessage)
        :   await container.settings.unset('new-thread-message');

        savedNewThreadUserMessage ?
            await container.settings.set('new-thread-user-confirm-message', savedNewThreadUserMessage)
        :   await container.settings.unset('new-thread-user-confirm-message');

        await container.settings.set('user-message-reaction', savedUserMessageReaction!);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await this.#sendSetupSummary(message);
        await interaction.deleteReply();
    }

    async #sendSetupSummary(message: Message) {
        const savedKeys: Key[] = [
            'prefix',
            'inbox-category',
            'log-channel',
            'anonymous-by-default',
            'anonymous-display-name',
            'new-thread-ping',
            'new-thread-message',
            'new-thread-user-confirm-message',
            'user-message-reaction',
        ];

        await message.edit(
            WizardService.buildStepData(
                'Confirmation',
                [
                    `Here is the configuration that was saved:`,
                    ...(await Promise.all(
                        savedKeys.map(
                            async (key) =>
                                `- **${settingNames[key]}:** ${formatSettingForMessage(key, await container.settings.get(key), true)}`,
                        ),
                    )),
                    `-# Note: if you left the team name empty, we assigned it a default value.`,
                ].join('\n'),
                'https://img.icons8.com/clouds/85/checkmark--v1.png',
            ),
        );
    }

    #getInvalidValueMessageData(): InteractionReplyOptions {
        const data = WizardService.buildStepData(
            'Oops!',
            'You were somehow able to leave a required field empty. This is not a valid configuration.',
            'https://img.icons8.com/clouds/85/error.png',
        );

        return {
            ...data,
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
    }
}
