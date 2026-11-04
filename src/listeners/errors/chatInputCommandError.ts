import { type ChatInputCommandErrorPayload, Listener, UserError } from '@sapphire/framework';
import * as Sentry from '@sentry/node';
import { MessageFlags } from 'discord-api-types/v10';

export class ChatInputCommandErrorListener extends Listener {
    public override async run(error: Error, context: ChatInputCommandErrorPayload) {
        const content =
            error instanceof UserError ?
                error.message
            :   `Something went wrong. Please try again later. (Error ID: ${crypto.randomUUID().split('-')[0]})`;

        if (!(error instanceof UserError)) {
            this.container.logger.error(`Command error in ${context.command.name}:`, error);
            Sentry.captureException(error, {
                extra: {
                    command: context.command.name,
                    userId: context.interaction.user.id,
                    guildId: context.interaction.guildId,
                },
            });
        }

        if (context.interaction.replied || context.interaction.deferred) {
            await context.interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        } else {
            await context.interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    }
}
