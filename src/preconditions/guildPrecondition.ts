import { AllFlowsPrecondition } from '@sapphire/framework';
import { type ChatInputCommandInteraction, type ContextMenuCommandInteraction, type Message } from 'discord.js';

export const GUILD_PRECONDITION_ERROR_IDENTIFIER = 'guild';

export class GuildPrecondition extends AllFlowsPrecondition {
    #message = 'This command can only be used in a server.';

    public constructor(context: AllFlowsPrecondition.LoaderContext, options: AllFlowsPrecondition.Options) {
        super(context, {
            ...options,
            position: 20,
        });
    }

    public override chatInputRun(interaction: ChatInputCommandInteraction) {
        return interaction.guildId ?
                this.ok()
            :   this.error({ identifier: GUILD_PRECONDITION_ERROR_IDENTIFIER, message: this.#message });
    }

    public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
        return interaction.guildId ?
                this.ok()
            :   this.error({ identifier: GUILD_PRECONDITION_ERROR_IDENTIFIER, message: this.#message });
    }

    public override async messageRun(message: Message) {
        return message.guildId ?
                this.ok()
            :   this.error({ identifier: GUILD_PRECONDITION_ERROR_IDENTIFIER, message: this.#message });
    }
}
