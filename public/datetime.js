const long = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const formatters = {
    short: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    t: new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }),
    T: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }),
    d: new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    D: new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }),
    f: new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }),
    F: new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }),
};

const UNITS = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
];

/** @param {Date} date */
function formatRelative(date) {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);

    for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size || unit === 'second') {
            return relative.format(Math.round(seconds / size), unit);
        }
    }
}

function render() {
    /** @var {HTMLTimeElement} element */
    for (const element of document.querySelectorAll('time[datetime]')) {
        const date = new Date(element.dateTime);
        const format = element.dataset.format;

        element.textContent =
            format === 'R' ? formatRelative(date) : (formatters[format] ?? formatters.short).format(date);

        if (element.hasAttribute('data-tip')) {
            element.setAttribute('data-tip', long.format(date));
        } else {
            element.title = long.format(date);
        }
    }
}

render();

if (document.querySelector('time[data-format="R"]')) {
    setInterval(render, 60_000);
}
