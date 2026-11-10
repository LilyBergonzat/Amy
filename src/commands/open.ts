import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandRegistry, type Args, type Awaitable, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, type Message, type User } from 'discord.js';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import { getCommandName } from '../lib/CommandService.js';

@ApplyOptions<Command.Options>({
    description: 'Open a new conversation thread',
    aliases: ['new', 'newthread', 'new-thread', 'openthread', 'open-thread'],
    options: ['recipient'],
})
export class OpenCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const userInput = await args.pick('string').catch(() => null);
        const matches = /(?<userId>\d{17,20})/v.exec(userInput ?? '');
        const recipientId = matches?.groups?.userId;
        const recipient = recipientId ? await message.client.users.fetch(recipientId).catch(() => null) : null;

        if (!recipient) {
            await message.reply('Could not find this user.');
            return;
        }

        await message.reply(await this.execute(message.author, recipient));
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply(
            await this.execute(interaction.user, interaction.options.getUser('recipient', true)),
        );
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addUserOption((option) =>
                    option.setName('recipient').setDescription('The recipient of the thread to open').setRequired(true),
                ),
        );
    }

    private async execute(openedBy: User, recipient: User) {
        let thread = await this.container.threads.getOpenThread(recipient, openedBy);

        if (thread) {
            return `There is already an open thread with this user: <#${thread.idChannel}>`;
        }

        thread = await this.container.threads.createThread(recipient, openedBy);

        if (!thread) {
            return `Unable to open a new thread. Make sure the bot is properly configured.`;
        }

        return `New thread created: <#${thread.idChannel}>`;
    }
}
