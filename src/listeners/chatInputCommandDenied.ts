import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ChatInputCommandDeniedPayload, type UserError } from '@sapphire/framework';
import { MessageFlags } from 'discord-api-types/v10';

@ApplyOptions<Listener.Options>({
    event: Events.ChatInputCommandDenied,
})
export class ChatInputCommandDeniedListener extends Listener {
    public override async run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.deferred) {
            await interaction.followUp({ content: error.message, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.editReply({ content: error.message });
    }
}
