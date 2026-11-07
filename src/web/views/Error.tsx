import type { PropsWithChildren } from 'hono/jsx';
import { Layout } from './Layout.js';
import { container } from '@sapphire/framework';

type Props = {
    code: number;
    title: string;
    description: string;
};

function ErrorPage({ code, title, description, children }: PropsWithChildren<Props>) {
    return (
        <Layout title={`Error ${code}`}>
            <div class="card w-96 shadow-sm mx-auto my-8 bg-neutral text-neutral-content pt-6">
                {container.client.user?.displayAvatarURL() && (
                    <figure class="w-14 h-14 rounded-full mx-auto">
                        <img src={container.client.user.displayAvatarURL()} alt="" />
                    </figure>
                )}
                <div class="card-body items-center text-center">
                    <small class="opacity-70">{code}</small>
                    <h2 class="card-title">{title}</h2>
                    <p>{description}</p>
                    {children && <div class="card-actions">{children}</div>}
                </div>
            </div>
        </Layout>
    );
}

export const Unauthorized = () => (
    <ErrorPage
        code={401}
        title={'Unauthenticated'}
        description={'Discord did not let you in. Maybe the link you clicked expired. Give it another go.'}
    >
        <a href="/discord-redirect" class="btn btn-primary">
            Try again
        </a>
    </ErrorPage>
);

export const Forbidden = () => (
    <ErrorPage code={403} title={'Forbidden'} description={'You do not have access to this content on this account.'}>
        <a href="/logout" class="btn btn-primary">
            Use another account
        </a>
    </ErrorPage>
);

export const NotFound = () => (
    <ErrorPage
        code={404}
        title={'Not Found'}
        description={
            'Whether you are searching for a thread, an attachment, or something else, it does not exist anymore, at least not at this address.'
        }
    />
);

export const InternalServerError = () => (
    <ErrorPage
        code={500}
        title={'Internal Server Error'}
        description={'Something went very wrong, but it is not your fault. Please try again later.'}
    />
);

export const ServiceUnavailable = () => (
    <ErrorPage
        code={503}
        title={'Service Unavailable'}
        description={'Amy is waking up. Wait a few seconds, and refresh this page.'}
    >
        <button class="btn btn-primary" onclick="location.reload()">
            Retry now
        </button>
    </ErrorPage>
);
