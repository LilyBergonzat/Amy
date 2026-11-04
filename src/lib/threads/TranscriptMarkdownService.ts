import type { TimestampStylesString } from 'discord.js';
import { rules, rulesExtended, SimpleMarkdown } from 'discord-markdown-parser';
import { GuildNavigationMentions } from '@discordjs/formatters';

type NavigationOf<T extends string> = T extends `<id:${infer Navigation}>` ? Navigation : never;
type GuildNavigation = NavigationOf<GuildNavigationMentions>;

export type BlockNode = { content: MarkdownNode[] };

export type HeadingNode = { type: 'heading'; level: 1 | 2 | 3 | 4 } & BlockNode;
export type SubtextNode = { type: 'subtext' } & BlockNode;
export type BrNode = { type: 'br' };
export type StrongNode = { type: 'strong' } & BlockNode;
export type TextNode = { type: 'text'; content: string };
export type EmNode = { type: 'em' } & BlockNode;
export type UnderlineNode = { type: 'underline' } & BlockNode;
export type StrikethroughNode = { type: 'strikethrough' } & BlockNode;
export type InlineCodeNode = { type: 'inlineCode'; content: string };
export type CodeBlockNode = { type: 'codeBlock'; lang: string; content: string; inQuote: boolean };
export type BlockQuoteNode = { type: 'blockQuote' } & BlockNode;
export type SpoilerNode = { type: 'spoiler' } & BlockNode;
export type UrlNode = { type: 'url'; target: string } & BlockNode;
export type AutolinkNode = { type: 'autolink'; target: string } & BlockNode;
export type LinkNode = { type: 'link'; title?: string; target: string } & BlockNode;
export type UserNode = { type: 'user'; id: string };
export type RoleNode = { type: 'role'; id: string };
export type ChannelNode = { type: 'channel'; id: string };
export type EveryoneNode = { type: 'everyone' };
export type HereNode = { type: 'here' };
export type SlashCommandNode = {
    type: 'slashCommand';
    fullName: string;
    name: string;
    subcommand: string | null;
    subcommandGroup: string | null;
    id: string;
};
export type GuildNavigationNode = { type: 'guildNavigation'; navigation: GuildNavigation; roleId: string | null };
export type EmojiNode = { type: 'emoji'; animated: boolean; name: string; id: string };
export type TwemojiNode = { type: 'twemoji'; name: string };
export type TimestampNode = { type: 'timestamp'; format?: TimestampStylesString; timestamp: string };

export const guildNavigationToLabelMap: Record<GuildNavigation, string> = {
    browse: '🔍 Browse Channels',
    customize: '🔍 Channels & Roles',
    guide: '🪧 Server Guide',
    'linked-roles': '🔗 Linked Roles',
};

export type MarkdownNode =
    | HeadingNode
    | SubtextNode
    | BrNode
    | StrongNode
    | TextNode
    | EmNode
    | UnderlineNode
    | StrikethroughNode
    | InlineCodeNode
    | CodeBlockNode
    | BlockQuoteNode
    | SpoilerNode
    | UrlNode
    | AutolinkNode
    | LinkNode
    | UserNode
    | RoleNode
    | ChannelNode
    | EveryoneNode
    | HereNode
    | SlashCommandNode
    | GuildNavigationNode
    | EmojiNode
    | TwemojiNode
    | TimestampNode;

const GUILD_NAVIGATION = /^<id:(?:(customize|browse|guide)|(linked-roles)(?::(\d{17,20}))?)>/v;

const guildNavigation = {
    order: rules.guildNavigation.order,
    match: (source: string) => GUILD_NAVIGATION.exec(source),
    parse: (capture: string[]) => ({
        navigation: capture[1] ?? capture[2],
        roleId: capture[3] ?? null,
    }),
};

const parser = SimpleMarkdown.parserFor({ ...rules, guildNavigation });
const parserExtended = SimpleMarkdown.parserFor({ ...rulesExtended, guildNavigation });

export function parse(content: string, extended: boolean = false): MarkdownNode[] {
    return (extended ? parserExtended : parser)(content, { inline: true }) as MarkdownNode[];
}
