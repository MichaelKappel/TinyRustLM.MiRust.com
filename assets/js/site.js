(() => {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('#primary-nav');
    const groups = Array.from(document.querySelectorAll('.nav-group'));

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const isOpen = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!isOpen));
            nav.dataset.open = String(!isOpen);
        });
    }

    groups.forEach((group) => {
        group.addEventListener('toggle', () => {
            if (!group.open) return;
            groups.forEach((other) => {
                if (other !== group) other.open = false;
            });
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        groups.forEach((group) => { group.open = false; });
        if (toggle && nav) {
            toggle.setAttribute('aria-expanded', 'false');
            nav.dataset.open = 'false';
        }
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.primary-nav')) return;
        groups.forEach((group) => { group.open = false; });
    });
})();
