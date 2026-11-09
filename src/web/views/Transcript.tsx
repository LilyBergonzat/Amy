import type { TranscriptMessage, TranscriptService } from '../../lib/threads/TranscriptService.js';
import { Layout } from './Layout.js';
import { Markdown } from './Markdown.js';
import { Attachments } from './Attachments.js';

type Props = {
    service: TranscriptService;
};

type Segment = { type: 'message'; message: TranscriptMessage } | { type: 'deleted'; messages: TranscriptMessage[] };

function formatDate(date: Date) {
    return date.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
    });
}

function TranscriptMessageItem({ message }: { message: TranscriptMessage }) {
    return (
        <div
            class={
                message.kind !== 'internal' ?
                    `chat ${message.kind === 'staff' ? 'chat-end' : 'chat-start'}`
                :   'internal my-2 ml-12'
            }
        >
            {message.kind === 'internal' ?
                <>
                    <div>
                        <div class="bg-neutral text-neutral-content rounded-2xl py-2 pl-3 border-2 border-dashed border-base-300 text-sm opacity-70">
                            <p>
                                <span class="font-bold">{message.author.name}</span>{' '}
                                <time datetime={message.date.toISOString()}>{formatDate(message.date)}</time>
                            </p>
                            <div class={`${message.deletedAt ? 'opacity-60 decoration-1' : ''}`}>
                                <Markdown content={message.contents} mentions={message.mentions} extended={true} />

                                {message.stickers.length > 0 && (
                                    <div class="flex flex-col gap-2 mt-2">
                                        {message.stickers.map((sticker) => (
                                            <img
                                                src={sticker.url}
                                                alt={sticker.description ?? sticker.name}
                                                title={sticker.name}
                                                class="sticker"
                                                width="160"
                                                height="160"
                                                key={sticker.id}
                                            />
                                        ))}
                                    </div>
                                )}
                                {message.attachments.length > 0 && <Attachments attachments={message.attachments} />}
                            </div>
                            {message.deletedAt && (
                                <p class="text-xs">
                                    🗑️ deleted{' '}
                                    <time datetime={message.deletedAt.toISOString()}>
                                        {formatDate(message.deletedAt)}
                                    </time>
                                </p>
                            )}
                        </div>
                    </div>
                </>
            :   <>
                    <div class="chat-image avatar">
                        <div class="w-10 rounded-full">
                            <img alt={message.author.name} src={message.author.avatarURL} />
                        </div>
                    </div>
                    <div class="chat-header">
                        <span class="font-bold">{message.author.name}</span>
                        <time class="opacity-50" datetime={message.date.toISOString()}>
                            {formatDate(message.date)}
                        </time>
                    </div>
                    <div
                        class={`chat-bubble ${message.kind === 'staff' ? 'chat-bubble-primary' : ''} ${message.deletedAt ? 'opacity-60 decoration-1' : ''}`}
                    >
                        {message.forwarded ?
                            <div class="forwarded">
                                <p class="forwarded-label">
                                    <span aria-hidden="true">↪</span> Forwarded
                                </p>
                                <div class="forwarded-content">
                                    <Markdown content={message.contents} mentions={message.mentions} extended={false} />
                                </div>
                            </div>
                        :   <Markdown
                                content={message.contents}
                                mentions={message.mentions}
                                extended={message.kind === 'staff'}
                            />
                        }

                        {message.stickers.length > 0 && (
                            <div class="flex flex-col gap-2 mt-2">
                                {message.stickers.map((sticker) => (
                                    <img
                                        src={sticker.url}
                                        alt={sticker.description ?? sticker.name}
                                        title={sticker.name}
                                        class="sticker"
                                        width="160"
                                        height="160"
                                        key={sticker.id}
                                    />
                                ))}
                            </div>
                        )}
                        {message.attachments.length > 0 && <Attachments attachments={message.attachments} />}
                    </div>
                    {(message.anonymousSentBy || message.previousVersions.length > 0 || message.deletedAt) && (
                        <div class="chat-footer flex flex-col">
                            {message.anonymousSentBy && (
                                <div class="opacity-50">
                                    sent anonymously by <span class="font-bold">{message.anonymousSentBy.name}</span>
                                </div>
                            )}
                            {message.previousVersions.length > 0 && (
                                <details class="edit-history">
                                    <summary class="opacity-50 cursor-pointer">
                                        edited{' '}
                                        <time datetime={message.editedAt!.toISOString()}>
                                            {formatDate(message.editedAt!)}
                                        </time>
                                    </summary>
                                    <ol class="flex flex-col gap-1 mt-1">
                                        {message.previousVersions.map((version) => (
                                            <li class="text-sm opacity-70 border-l-2 border-base-300 pl-2">
                                                <time class="text-xs" datetime={version.date.toISOString()}>
                                                    {formatDate(version.date)}
                                                </time>
                                                <Markdown
                                                    content={version.contents}
                                                    mentions={version.mentions}
                                                    extended={message.kind !== 'user'}
                                                />
                                            </li>
                                        ))}
                                    </ol>
                                </details>
                            )}
                            {message.deletedAt && (
                                <div class="opacity-50">
                                    🗑️ deleted{' '}
                                    <time datetime={message.deletedAt.toISOString()}>
                                        {formatDate(message.deletedAt)}
                                    </time>
                                </div>
                            )}
                        </div>
                    )}
                </>
            }
        </div>
    );
}

export async function Transcript({ service }: Props) {
    const thread = await service.getThreadData();
    const messages = await service.getMessages();
    const segments = messages.reduce<Segment[]>((segments, message) => {
        const last = segments.at(-1);

        if (message.deletedAt && last?.type === 'deleted') {
            last.messages.push(message);
        } else if (message.deletedAt) {
            segments.push({ type: 'deleted', messages: [message] });
        } else {
            segments.push({ type: 'message', message });
        }

        return segments;
    }, []);

    const plural = (n: number) => `${n} deleted message${n > 1 ? 's' : ''}`;

    return (
        <Layout title={`${thread.recipient.name} - Modmail Transcript`}>
            <main class="max-w-3xl mx-auto p-4 flex flex-col gap-4">
                <section class="card card-border bg-base-200 max-w-fit mx-auto">
                    <div class="card-body flex-row items-center">
                        <img src={thread.recipient.avatarURL} alt={thread.recipient.name} class="w-10 rounded-full" />
                        <div class="flex flex-col">
                            <p class="font-bold">{thread.recipient.name}</p>
                            <p>
                                Opened by{' '}
                                {thread.openedByUser ?
                                    'user'
                                :   <>
                                        staff {thread.openedBy && <span class="font-bold">{thread.openedBy.name}</span>}
                                    </>
                                }{' '}
                                on <time datetime={thread.openedAt.toISOString()}>{formatDate(thread.openedAt)}</time>
                            </p>
                            {!thread.isOpen && (
                                <p>
                                    Closed on{' '}
                                    <time datetime={thread.closedAt!.toISOString()}>
                                        {formatDate(thread.closedAt!)}
                                    </time>
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <section class="text-center">
                    <label class="label cursor-pointer text-base-content">
                        <input type="checkbox" class="toggle mr-2" id="show-internal" />
                        Show internal conversation
                    </label>
                </section>

                <section>
                    {segments.map((segment, i) =>
                        segment.type === 'message' ?
                            <TranscriptMessageItem message={segment.message} key={i} />
                        :   <details class="deleted-group" key={i}>
                                <summary class="divider text-xs opacity-60 cursor-pointer">
                                    <span class="count-all">🗑️ {plural(segment.messages.length)}</span>
                                    <span class="count-public">
                                        🗑️ {plural(segment.messages.filter((m) => m.kind !== 'internal').length)}
                                    </span>
                                </summary>
                                <div class="deleted-messages">
                                    {segment.messages.map((message) => (
                                        <TranscriptMessageItem message={message} />
                                    ))}
                                </div>
                            </details>,
                    )}
                </section>
            </main>

            <dialog id="lightbox" class="lightbox">
                <div class="lightbox-stage">
                    <figure class="lightbox-frame">
                        <img class="lightbox-image" alt="" />
                        <video class="lightbox-video" controls />
                        <button type="button" class="lightbox-reveal" aria-label="Reveal spoiler">
                            <span class="spoiler-badge">Spoiler</span>
                        </button>
                    </figure>
                </div>
                <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 6l-6 6 6 6" />
                    </svg>
                </button>
                <button type="button" class="lightbox-nav lightbox-next" aria-label="Next">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                    </svg>
                </button>
                <div class="lightbox-bar">
                    <span class="lightbox-counter"></span>
                    <a class="lightbox-original" target="_blank" rel="noopener">
                        Open in browser
                    </a>
                </div>
            </dialog>
        </Layout>
    );
}
