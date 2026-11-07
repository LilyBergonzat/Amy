import { type Context, type Next } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { container } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v10';
import { SECOND, YEAR } from '../../lib/utils/datetime.js';
import {
    getCookie,
    redirectToGoBackTo,
    respondForbidden,
    respondUnauthorized,
    respondUnavailable,
    setCookie,
    setGoBackToCookie,
} from '../../lib/WebService.js';

const redirectToDiscordAuth = async (c: Context) => {
    await setGoBackToCookie(c);
    return c.redirect('/discord-redirect');
};

export const postDiscordAuthMiddleware = async (c: Context) => {
    const user = c.get('user-discord');

    if (!user || !user.id) {
        return respondUnauthorized(c);
    }

    await setCookie(c, 'discord_user', user.id, { maxAge: YEAR / SECOND });

    return redirectToGoBackTo(c);
};

export const discordLoggedInMiddleware = async (c: Context, next: Next) => {
    const userId = await getCookie(c, 'discord_user');

    if (!userId) {
        return redirectToDiscordAuth(c);
    }

    if (!container.client.isReady()) {
        return respondUnavailable(c);
    }

    const guild = await container.settings.getInboxServer();
    const category = await container.settings.getInboxCategory();

    if (!guild || !category) {
        return respondUnavailable(c);
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    const allowed = member !== null && category.permissionsFor(member).has(PermissionFlagsBits.ViewChannel);

    if (!allowed) {
        return respondForbidden(c);
    }

    return next();
};

export const discordLogout = async (c: Context) => {
    deleteCookie(c, 'discord_user');
    return redirectToGoBackTo(c);
};
