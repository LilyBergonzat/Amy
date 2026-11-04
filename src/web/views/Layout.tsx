import { type PropsWithChildren } from 'hono/jsx';
import { html } from 'hono/html';
import path from 'node:path';
import { statSync } from 'node:fs';

type Props = {
    title: string;
};

function asset(file: string): string {
    try {
        return `/${file}?v=${Math.round(statSync(path.join('public', file)).mtimeMs)}`;
    } catch {
        return `/${file}`;
    }
}

export function Layout({ title, children }: PropsWithChildren<Props>) {
    return (
        <>
            {html`<!doctype html>`}
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />

                    <title>Amy - {title}</title>

                    <meta name="viewport" content="width=device-width, initial-scale=1" />

                    <link rel="stylesheet" type="text/css" href={asset('styles.css')} />

                    <script type="text/javascript" defer={true} src={asset('datetime.js')}></script>
                    <script type="text/javascript" defer={true} src={asset('spoiler.js')}></script>
                    <script type="text/javascript" defer={true} src={asset('copy-id.js')}></script>
                    <script type="text/javascript" defer={true} src={asset('lightbox.js')}></script>
                </head>
                <body>{children}</body>
            </html>
        </>
    );
}
