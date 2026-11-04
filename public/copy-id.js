const COPIED = '✅ Copied';
const timers = new WeakMap();

document.addEventListener('click', async (event) => {
    const element = event.target.closest('[data-id]');

    if (!element || element.closest('.spoiler:not(.revealed)')) {
        return;
    }

    await navigator.clipboard.writeText(element.dataset.id);

    element.dataset.tip = COPIED;
    element.classList.add('tooltip-success', 'tooltip-open');

    clearTimeout(timers.get(element));

    timers.set(
        element,
        setTimeout(() => {
            element.dataset.tip = element.dataset.id;
            element.classList.remove('tooltip-success', 'tooltip-open');
        }, 1500),
    );
});
