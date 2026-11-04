import { type JSX } from 'hono/jsx';
import type { MentionData, MentionTypes } from '../../lib/utils/mention.js';
import { guildNavigationToLabelMap, parse } from '../../lib/threads/TranscriptMarkdownService.js';
import type { MarkdownNode } from '../../lib/threads/TranscriptMarkdownService.js';
import { container } from '@sapphire/framework';
import type { RoleColors } from 'discord.js';
import hljs from 'highlight.js/lib/common';
import { raw } from 'hono/html';

type Props = {
    content: string;
    mentions: MentionData | null;
    extended: boolean;
};

function getMentionData<K extends keyof MentionData>(
    mentions: MentionData | null,
    type: K,
    id: string,
): MentionTypes[K] | null {
    return mentions?.[type][id] ?? null;
}

function hex(colour: number) {
    return `#${colour.toString(16).padStart(6, '0')}`;
}

function roleColoursToStyle(colours?: RoleColors) {
    return [
        ...(colours?.primaryColor ? [`--c1: ${hex(colours.primaryColor)}`] : []),
        ...(colours?.secondaryColor ? [`--c2: ${hex(colours.secondaryColor)}`] : []),
        ...(colours?.tertiaryColor ? [`--c3: ${hex(colours.tertiaryColor)}`] : []),
    ].join('; ');
}

function Node({ node, mentions }: { node: MarkdownNode; mentions: MentionData | null }) {
    switch (node.type) {
        case 'timestamp':
            const date = new Date(Number(node.timestamp) * 1000);
            const long = date.toLocaleString('en-GB', {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'UTC',
            });
            const short = date.toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'UTC',
            });

            return (
                <time class="tooltip" datetime={date.toISOString()} data-format={node.format ?? 'f'} data-tip={long}>
                    {short}
                </time>
            );

        case 'twemoji':
            return <>{node.name}</>;

        case 'emoji':
            return (
                <img
                    class="emoji"
                    src={`https://cdn.discordapp.com/emojis/${node.id}.${node.animated ? 'gif' : 'webp'}?size=44&quality=lossless`}
                    alt={`:${node.name}:`}
                    title={`:${node.name}:`}
                    loading="lazy"
                    draggable={false}
                />
            );

        case 'guildNavigation':
            return <span class="mention">{guildNavigationToLabelMap[node.navigation]}</span>;

        case 'slashCommand':
            return <span class="mention">/{node.fullName}</span>;

        case 'everyone':
        case 'here':
            return <span class="mention">@{node.type}</span>;

        case 'channel':
            return (
                <span class="mention tooltip" data-id={node.id} data-tip={node.id} tabindex={0}>
                    #{getMentionData(mentions, node.type, node.id)?.name ?? 'unknown-channel'}
                </span>
            );

        case 'role':
            const role = getMentionData(mentions, node.type, node.id);

            return (
                <span
                    class={`mention role tooltip ${!role?.colours.secondaryColor ? 'solid' : ''}`}
                    style={roleColoursToStyle(role?.colours)}
                    data-id={node.id}
                    data-tip={node.id}
                    tabindex={0}
                >
                    {!role?.colours.secondaryColor ?
                        <>@{role?.name ?? 'unknown-role'}</>
                    :   <span
                            class={`gradient-text ${role.colours.tertiaryColor ? 'three' : ''}`}
                            data-text={`@${role.name}`}
                        >
                            @{role.name}
                        </span>
                    }
                </span>
            );

        case 'user':
            return (
                <span class="mention tooltip" data-id={node.id} data-tip={node.id} tabindex={0}>
                    @{getMentionData(mentions, node.type, node.id)?.displayName ?? 'unknown-user'}
                </span>
            );

        case 'url':
        case 'autolink':
        case 'link':
            return URL.canParse(node.target) && new URL(node.target).protocol.startsWith('http') ?
                    <a
                        href={node.target}
                        target="_blank"
                        title={'title' in node && node.title ? node.title : undefined}
                        rel="noopener noreferrer"
                    >
                        <Nodes nodes={node.content} mentions={mentions} />
                    </a>
                :   <Nodes nodes={node.content} mentions={mentions} />;

        case 'spoiler':
            return (
                <span class="spoiler">
                    <span class="spoiler-content">
                        <Nodes nodes={node.content} mentions={mentions} />
                    </span>
                </span>
            );

        case 'blockQuote':
            return (
                <blockquote>
                    <Nodes nodes={node.content} mentions={mentions} />
                </blockquote>
            );

        case 'subtext':
            return (
                <small class="opacity-70">
                    <Nodes nodes={node.content} mentions={mentions} />
                </small>
            );

        case 'heading':
            const Tag = `h${node.level}` as keyof JSX.IntrinsicElements;

            return (
                <Tag>
                    <Nodes nodes={node.content} mentions={mentions} />
                </Tag>
            );

        case 'codeBlock':
            const language = node.lang && hljs.getLanguage(node.lang) ? node.lang : null;

            return (
                <pre>
                    <code class={`hljs${language ? ` language-${language}` : ''}`}>
                        {language ?
                            raw(hljs.highlight(node.content, { language, ignoreIllegals: true }).value)
                        :   node.content}
                    </code>
                </pre>
            );

        case 'inlineCode':
            return <code>{node.content}</code>;

        case 'underline':
            return (
                <u>
                    <Nodes nodes={node.content} mentions={mentions} />
                </u>
            );

        case 'strikethrough':
            return (
                <s>
                    <Nodes nodes={node.content} mentions={mentions} />
                </s>
            );

        case 'em':
            return (
                <em>
                    <Nodes nodes={node.content} mentions={mentions} />
                </em>
            );

        case 'strong':
            return (
                <strong>
                    <Nodes nodes={node.content} mentions={mentions} />
                </strong>
            );

        case 'text':
            return <>{node.content}</>;

        case 'br':
            return <br />;

        default:
            const data = node as Record<string, unknown>;
            const content = 'content' in data && typeof data.content === 'string' ? data.content : '';

            container.logger.warn(`Unknown node type: ${data.type}.`, data);

            return <>{content}</>;
    }
}

function Nodes({ nodes, mentions }: { nodes: MarkdownNode[]; mentions: MentionData | null }) {
    return nodes.map((node, index) =>
        node.type === 'br' && nodes[index - 1]?.type === 'codeBlock' ?
            null
        :   <Node node={node} mentions={mentions} key={index} />,
    );
}

const JUMBO_TYPES = new Set(['emoji', 'twemoji', 'newline', 'br']);

export function Markdown({ content, mentions, extended }: Props) {
    const nodes = parse(content, extended);
    const isJumbo =
        nodes.length > 0 &&
        nodes.every((node) => JUMBO_TYPES.has(node.type) || (node.type === 'text' && node.content.trim() === ''));

    return (
        <div class={`markdown ${isJumbo ? 'jumbo' : ''}`}>
            <Nodes nodes={nodes} mentions={mentions} />
        </div>
    );
}
