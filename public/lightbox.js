const dialog = document.getElementById('lightbox');

/** @type {HTMLImageElement} */
const image = dialog?.querySelector('.lightbox-image');

/** @type {HTMLVideoElement} */
const video = dialog?.querySelector('.lightbox-video');
const original = dialog?.querySelector('.lightbox-original');
const counter = dialog?.querySelector('.lightbox-counter');
let items = [];
let index = 0;

function show(target) {
    index = (target + items.length) % items.length;

    const link = items[index];
    const hasImage = Boolean(link.querySelector('img'));

    if (hasImage) {
        video.pause();
        video.removeAttribute('src');
        video.style.display = 'none';
        image.style.display = '';
        image.src = link.href;
        image.alt = link.querySelector('img')?.alt ?? '';
        original.href = link.href;
    } else {
        image.style.display = 'none';
        video.style.display = '';
        video.src = link.getAttribute('data-href');
        original.href = link.getAttribute('data-href');
    }

    counter.textContent = `${index + 1} / ${items.length}`;
    dialog.classList.toggle('single', items.length === 1);
    dialog.classList.toggle('concealed', link.classList.contains('spoiler') && !link.classList.contains('revealed'));
}

document.addEventListener('click', (event) => {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }

    const link = event.target.closest('a.media');

    if (!link) {
        return;
    }

    event.preventDefault();

    const gallery = link.closest('.gallery');

    items = gallery ? [...gallery.querySelectorAll('.media')] : [link];
    show(items.indexOf(link));
    dialog.showModal();
});

dialog?.addEventListener('click', (event) => {
    if (event.target.closest('.lightbox-reveal')) {
        items[index].classList.add('revealed');
        dialog.classList.remove('concealed');
    } else if (event.target.closest('.lightbox-prev')) {
        show(index - 1);
    } else if (event.target.closest('.lightbox-next')) {
        show(index + 1);
    } else if (event.target === dialog || event.target.classList.contains('lightbox-stage')) {
        dialog.close();
    }
});

dialog?.addEventListener('keydown', (event) => {
    if (event.target?.nodeName?.toLowerCase() === 'video') {
        return;
    }

    if (event.key === 'ArrowLeft') {
        show(index - 1);
    } else if (event.key === 'ArrowRight') {
        show(index + 1);
    }
});

dialog?.addEventListener('close', () => {
    image.removeAttribute('src');
    video.pause();
    video.removeAttribute('src');
});
