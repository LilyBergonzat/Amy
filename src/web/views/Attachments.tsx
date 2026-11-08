import type { TranscriptAttachmentData } from '../../lib/threads/TranscriptService.js';
import { isGalleryMedia } from '../../lib/utils/discord.js';

type Props = {
    attachments: TranscriptAttachmentData[];
};

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

function tileSpan(index: number, count: number): string {
    if (count === 1) {
        return '';
    }

    if (count === 2 || count === 4) {
        return 'col-span-3';
    }

    const remainder = count % 3;

    if (remainder === 1 && index === 0) {
        return 'col-span-6';
    }

    if (remainder === 2 && index < 2) {
        return 'col-span-3';
    }

    return 'col-span-2';
}

function formatSize(bytes: number): string {
    const exponent = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);

    return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 2)} ${SIZE_UNITS[exponent]}`;
}

function MediaTile({
    attachment,
    single,
    span,
}: {
    attachment: TranscriptAttachmentData;
    single: boolean;
    span: string;
}) {
    const isVideo = attachment.contentType?.startsWith('video/') ?? false;
    const Wrapper = isVideo ? 'div' : 'a';
    const sizing = single ? 'w-auto max-w-full max-h-96' : 'w-full h-full object-cover';

    return (
        <Wrapper
            {...(isVideo ?
                { 'data-href': attachment.url }
            :   { href: attachment.url, target: '_blank', rel: 'noopener' })}
            class={`media ${single ? 'w-fit' : 'aspect-square'} ${span} ${attachment.spoiler ? 'spoiler' : ''}`}
        >
            {isVideo ?
                <video
                    controls
                    preload="metadata"
                    src={attachment.url}
                    width={attachment.width ?? undefined}
                    height={attachment.height ?? undefined}
                    class={sizing}
                />
            :   <img
                    src={attachment.url}
                    alt={attachment.description ?? attachment.name}
                    width={attachment.width ?? undefined}
                    height={attachment.height ?? undefined}
                    loading="lazy"
                    class={sizing}
                />
            }
            {attachment.spoiler && (
                <span class="media-overlay">
                    <span class="spoiler-badge">Spoiler</span>
                </span>
            )}
        </Wrapper>
    );
}

function FileCard({ attachment }: { attachment: TranscriptAttachmentData }) {
    return (
        <a
            href={attachment.url}
            download={attachment.name}
            class="attachment flex items-center gap-3 max-w-xs rounded-lg border border-base-300 bg-base-100 text-base-content px-3 py-2 no-underline hover:bg-base-200"
        >
            <span class="text-2xl" aria-hidden="true">
                📄
            </span>
            <span class="flex flex-col min-w-0">
                <span class="font-medium truncate">{attachment.name}</span>
                <span class="text-xs opacity-60">{formatSize(attachment.size)}</span>
            </span>
            <span class="btn btn-ghost btn-sm btn-circle ml-auto" aria-hidden="true">
                ⬇
            </span>
        </a>
    );
}

function Attachment({ attachment }: { attachment: TranscriptAttachmentData }) {
    const contentType = attachment.contentType ?? null;

    if (contentType?.startsWith('audio/')) {
        return <audio controls preload="metadata" src={attachment.url} class="attachment w-full min-w-xs max-w-sm" />;
    }

    return <FileCard attachment={attachment} />;
}

export function Attachments({ attachments }: Props) {
    const media = attachments.filter((attachment) => isGalleryMedia(attachment.contentType ?? null));
    const others = attachments.filter((attachment) => !isGalleryMedia(attachment.contentType ?? null));

    if (attachments.length === 0) {
        return null;
    }

    return (
        <div class="flex flex-col items-start gap-2 mt-2">
            {media.length > 0 && (
                <div class={media.length === 1 ? '' : 'grid grid-cols-6 gap-1 w-full max-w-md gallery'}>
                    {media.map((attachment, index) => (
                        <MediaTile
                            attachment={attachment}
                            single={media.length === 1}
                            span={tileSpan(index, media.length)}
                            key={attachment.id}
                        />
                    ))}
                </div>
            )}
            {others.map((attachment) => (
                <Attachment attachment={attachment} key={attachment.id} />
            ))}
        </div>
    );
}
