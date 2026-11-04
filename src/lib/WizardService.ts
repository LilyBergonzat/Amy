import { ContainerBuilder, type Interaction, type Message, MessageFlags } from 'discord.js';
import * as path from 'node:path';
import { ComponentType } from 'discord-api-types/v10';
import { MINUTE } from './utils/datetime.js';
import type { WizardController } from './WizardController.js';
import { readdir } from 'node:fs/promises';
import { container } from '@sapphire/framework';

export type InteractionWithCustomId = Extract<Interaction, { customId: string }>;
type WizardControllerConstructor = new () => WizardController;
type WizardControllerImport = { default: WizardControllerConstructor };
type WizardControllerData = { instance: WizardController; actions: Set<string> };
type WizardControllerAction = (interaction: InteractionWithCustomId, ...parameters: string[]) => Promise<void> | void;

const PREFIX = 'wizard:';

export class WizardService {
    private static controllers: Map<string, WizardControllerData> = new Map<string, WizardControllerData>();
    private static initialized = false;

    public static async init() {
        if (WizardService.initialized) {
            return;
        }

        container.logger.info('Loading wizard controllers...');
        const controllers = await readdir(path.join(import.meta.dirname, 'wizard'));

        for (const controller of controllers) {
            if (!controller.endsWith('.js')) {
                continue;
            }

            const controllerClass: WizardControllerImport = await import(`./wizard/${controller}`);
            const controllerInstance = new controllerClass.default();
            const filteredOut = ['constructor'];

            this.controllers.set(controller.slice(0, -3), {
                instance: controllerInstance,
                actions: new Set(
                    Object.getOwnPropertyNames(controllerClass.default.prototype).filter(
                        (k) =>
                            !filteredOut.includes(k) &&
                            typeof controllerInstance[k as keyof WizardController] === 'function',
                    ),
                ),
            });
        }

        container.logger.info(
            `Loaded ${WizardService.controllers.size} wizard controller${WizardService.controllers.size > 1 ? 's' : ''}.`,
        );

        WizardService.initialized = true;
    }

    public static interactionHandler(interaction: Interaction) {
        if (!WizardService.interactionHasCustomId(interaction) || !interaction.customId.startsWith(PREFIX)) {
            return;
        }

        const customId = interaction.customId;
        const [, controller, action, parameters] = customId.split(':');

        if (!controller) {
            return;
        }

        return this.route(interaction, controller, action ?? 'index', parameters?.split(','));
    }

    public static buildId({
        controller,
        action,
        parameters,
    }: {
        controller: string;
        action?: string;
        parameters?: string[];
    }) {
        const parameterPart = parameters ? `:${parameters.join(',')}` : '';
        const actionPart = action || parameters ? `:${action ?? 'index'}${parameterPart}` : '';

        return `${PREFIX}${controller}${actionPart}`;
    }

    public static buildStepData(title: string, content: string, thumbnailUrl: string) {
        return {
            components: [
                new ContainerBuilder({
                    components: [
                        {
                            type: ComponentType.Section,
                            accessory: {
                                type: ComponentType.Thumbnail,
                                media: { url: thumbnailUrl },
                            },
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: `# ${title}\n${content}`,
                                },
                            ],
                        },
                    ],
                }),
            ],
        };
    }

    public static async ensureAllowedUser(interaction: InteractionWithCustomId) {
        const responseMessage = interaction.message;
        const originalUser = responseMessage?.interactionMetadata?.user;

        if (!originalUser) {
            await interaction.reply({
                content: 'This interaction was wired incorrectly. Please let the owner of this bot know.',
                flags: MessageFlags.Ephemeral,
            });

            return false;
        }

        if (interaction.user.id !== originalUser.id) {
            await interaction.reply({
                content: 'This button is not yours to click.',
                flags: MessageFlags.Ephemeral,
            });

            return false;
        }

        if (Date.now() - (responseMessage.editedTimestamp ?? responseMessage.createdTimestamp) > 30 * MINUTE) {
            await interaction.reply({
                content: 'This button has expired. Please run the command again.',
                flags: MessageFlags.Ephemeral,
            });

            return false;
        }

        return true;
    }

    public static async getOriginalMessage(interaction: InteractionWithCustomId, required: true): Promise<Message>;
    // noinspection JSUnusedGlobalSymbols
    public static async getOriginalMessage(
        interaction: InteractionWithCustomId,
        required: false,
    ): Promise<Message | null>;
    // noinspection JSUnusedGlobalSymbols
    public static async getOriginalMessage(interaction: InteractionWithCustomId): Promise<Message | null>;
    public static async getOriginalMessage(
        interaction: InteractionWithCustomId,
        required: boolean = false,
    ): Promise<typeof required extends true ? Message : Message | null> {
        const originalMessage = interaction.message;

        if (required && !originalMessage) {
            throw new Error('Interaction does not have an original message.');
        }

        return originalMessage;
    }

    private static async route(
        interaction: InteractionWithCustomId,
        controller: string,
        action: string,
        parameters?: string[],
    ) {
        if (!this.controllers.has(controller)) {
            await interaction.reply({
                content: `Something went wrong, this element does not seem to be tied to any action. If you report this problem, here is the debug data you can attach: \`${interaction.customId}\``,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const controllerData = this.controllers.get(controller)!;
        const controllerInstance = controllerData.instance;

        if (!controllerData.actions.has(action)) {
            await interaction.reply({
                content: `Something went wrong, this element is not tied correctly to an action. If you report this problem, here is the debug data you can attach: \`${interaction.customId}\``,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const actionMethod = controllerInstance[action as keyof WizardController] as WizardControllerAction;

        await actionMethod.call(controllerInstance, interaction, ...(parameters ?? []));
    }

    private static interactionHasCustomId(interaction: Interaction): interaction is InteractionWithCustomId {
        return 'customId' in interaction;
    }
}
