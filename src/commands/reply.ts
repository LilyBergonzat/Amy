import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command, type MessageCommand } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { fetchSnippet } from '../lib/SnippetService.js';
import { getCommandMention } from '../lib/utils/mention.js';

@ApplyOptions<Command.Options>({
    description: '(In a thread) Reply to the current thread',
    aliases: ['r', 'ar', 'nar', 'nr', 'anonymous-reply', 'not-anonymous-reply', 'non-anonymous-reply'],
    options: ['message'],
    flags: ['anonymous', 'a', 'not-anonymous', 'n', 'snippet', 's'],
})
export class ReplyCommand extends Command {
    public override async messageRun(message: Message, args: Args, context: MessageCommand.RunContext) {
        const reply = await args.rest('string').catch(() => null);
        const thread = await this.container.threads.getThreadByChannel(message.channelId);
        const hasAttachments = message.attachments.size > 0 || message.stickers.size > 0;

        if ((!reply || reply.trim().length < 1) && !hasAttachments) {
            await message.reply('You need to type a response or attach files to send.');
            return;
        }

        if (!thread) {
            await message.reply('This channel does not seem to be a modmail thread.');
            return;
        }

        const snippetFlag = args.getFlags('snippet', 's');
        const anonymousFlagSet = args.getFlags('anonymous', 'a');
        const notAnonymousFlagSet = args.getFlags('not-anonymous', 'n');
        const explicitAnonymousCommandUsed = ['ar', 'anonymous-reply'].includes(context.commandName.toLowerCase());
        const explicitNotAnonymousCommandUsed = ['nar', 'nr', 'not-anonymous-reply', 'non-anonymous-reply'].includes(
            context.commandName.toLowerCase(),
        );
        let contents = reply;
        let anonymousOverride = undefined;

        if (anonymousFlagSet && notAnonymousFlagSet) {
            await message.reply('You cannot request for a reply to be both anonymous and not anonymous.');
            return;
        }

        if (anonymousFlagSet || notAnonymousFlagSet) {
            anonymousOverride = anonymousFlagSet;
        } else if (explicitAnonymousCommandUsed || explicitNotAnonymousCommandUsed) {
            anonymousOverride = explicitAnonymousCommandUsed;
        }

        if (snippetFlag) {
            const snippet = reply ? await fetchSnippet(reply) : null;

            if (!snippet) {
                await message.reply(
                    `This snippet does not seem to exist. Try using the ${getCommandMention('snippet')} command, it should be easier to find what you are looking for!`,
                );
                return;
            }

            contents = snippet.content;
        }

        const sent = await this.container.threads.sendMessageFromStaff(
            thread,
            contents,
            message.member!,
            message,
            anonymousOverride,
        );

        if (!sent) {
            await message.reply('Unable to send your message. Make sure the bot is properly configured.');
        }
    }
}
