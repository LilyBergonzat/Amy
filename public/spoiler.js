document.addEventListener('click', (event) => {
    const spoiler = event.target.closest('.spoiler:not(.revealed)');

    if (!spoiler) {
        return;
    }

    event.preventDefault();
    spoiler.classList.add('revealed');
});
