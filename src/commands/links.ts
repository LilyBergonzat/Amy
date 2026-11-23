import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandRegistry, type Args, type Awaitable, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, type Message, type User } from 'discord.js';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import { getCommandName } from '../lib/CommandService.js';
import { WebService } from '../lib/WebService.js';

@ApplyOptions<Command.Options>({
    description: 'List all past conversation threads with a member',
    aliases: ['list', 'threads', 'logs'],
})
export class LinksCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const userInput = await args.pick('string').catch(() => null);
        const thread = userInput ? null : await this.container.threads.getThreadByChannel(message.channelId);
        const matches = /(?<userId>\d{17,20})/v.exec(userInput ?? '');
        const userId = matches?.groups?.userId ?? thread?.idRecipient;
        const user = userId ? await message.client.users.fetch(userId).catch(() => null) : null;

        if (!user) {
            await message.reply(
                userInput ? 'Could not find this user.' : (
                    'You need to either execute this in a modmail thread or provide a user id.'
                ),
            );
            return;
        }

        await this.execute(user, (content) => message.reply(content));
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: 'Searching...', flags: MessageFlags.Ephemeral });

        const userOption = interaction.options.getUser('user');
        const thread = userOption ? null : await this.container.threads.getThreadByChannel(interaction.channelId);
        const threadUser = thread ? await interaction.client.users.fetch(thread.idRecipient).catch(() => null) : null;
        const user = userOption ?? threadUser;

        if (!user) {
            await interaction.editReply(
                userOption ? 'Could not find this user.' : (
                    'You need to either execute this in a modmail thread or provide a user id.'
                ),
            );
            return;
        }

        await this.execute(user, (content: string) => interaction.followUp(content));
        await interaction.editReply('Done.');
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(getCommandName(this.name))
                .setDescription(this.description)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addUserOption((option) =>
                    option.setName('user').setDescription('The user to list all threads of').setRequired(false),
                ),
        );
    }

    private async execute(user: User, reply: (reply: string) => Promise<Message>) {
        const threads = await this.container.threads.getThreads(user);

        if (threads.length < 1) {
            await reply(`There are no past threads with this user.`);
            return;
        }

        const messages = [];
        let message = '';

        while (threads.length > 0) {
            let thread;

            while ((thread = threads.shift())) {
                const link = `- <${new WebService().url(`/thread/${thread.id}`)}>`;

                if (message.length + link.length + 1 > 2000) {
                    messages.push(message);
                    message = '';
                }

                message = `${message}\n${link}`;
            }
        }

        if (message.length > 0) {
            messages.push(message);
        }

        for (const message of messages) {
            await reply(message);
        }
    }
}
