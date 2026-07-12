(() => {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('#primary-nav');
    const groups = Array.from(document.querySelectorAll('.nav-group'));
    const searchToggle = document.querySelector('.search-toggle');
    const searchDialog = document.querySelector('#quick-find');
    const searchClose = document.querySelector('.quick-find-close');
    const searchInput = document.querySelector('#quick-find-input');
    const searchResults = Array.from(document.querySelectorAll('.quick-find-results a'));
    const searchEmpty = document.querySelector('.quick-find-empty');
    const progress = document.querySelector('.reading-progress span');
    const backToTop = document.querySelector('.back-to-top');
    const copyStatus = document.querySelector('.copy-status');
    const railLinks = Array.from(document.querySelectorAll('.page-rail nav a[href^="#"]'));

    const closeMenu = () => {
        if (!toggle || !nav) return;
        toggle.setAttribute('aria-expanded', 'false');
        nav.dataset.open = 'false';
        groups.forEach((group) => { group.open = false; });
    };

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const nextOpen = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(nextOpen));
            nav.dataset.open = String(nextOpen);
        });

        nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    }

    groups.forEach((group) => {
        group.addEventListener('toggle', () => {
            if (!group.open) return;
            groups.forEach((other) => {
                if (other !== group) other.open = false;
            });
        });
    });

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('.site-header')) return;
        groups.forEach((group) => { group.open = false; });
    });

    const filterSearch = () => {
        const terms = (searchInput?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        let visible = 0;
        searchResults.forEach((link) => {
            const haystack = link.dataset.searchValue || '';
            const matches = terms.every((term) => haystack.includes(term));
            link.hidden = !matches;
            if (matches) visible += 1;
        });
        if (searchEmpty) searchEmpty.hidden = visible !== 0;
    };

    const openSearch = () => {
        if (!(searchDialog instanceof HTMLDialogElement)) return;
        closeMenu();
        if (!searchDialog.open) searchDialog.showModal();
        filterSearch();
        window.setTimeout(() => searchInput?.focus(), 0);
    };

    searchToggle?.addEventListener('click', openSearch);
    searchClose?.addEventListener('click', () => searchDialog?.close());
    searchInput?.addEventListener('input', filterSearch);
    searchDialog?.addEventListener('click', (event) => {
        if (event.target === searchDialog) searchDialog.close();
    });

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openSearch();
            return;
        }
        if (event.key !== 'Escape' || searchDialog?.open) return;
        closeMenu();
        toggle?.focus();
    });

    const setActiveSection = (id) => {
        railLinks.forEach((link) => {
            const active = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    };

    if ('IntersectionObserver' in window) {
        const sections = Array.from(document.querySelectorAll('.content-section[id]'));
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
            if (visible[0]) setActiveSection(visible[0].target.id);
        }, { rootMargin: '-18% 0px -66% 0px', threshold: [0.05, 0.25, 0.5] });
        sections.forEach((section) => observer.observe(section));
    }

    const updateScrollState = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
        if (progress) progress.style.width = `${ratio * 100}%`;
        backToTop?.classList.toggle('is-visible', window.scrollY > 640);
    };

    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', () => {
        if (window.matchMedia('(min-width: 1081px)').matches) closeMenu();
        updateScrollState();
    });
    updateScrollState();

    backToTop?.addEventListener('click', () => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        document.querySelector('.brand')?.focus({ preventScroll: true });
    });

    const copyText = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Copy command was rejected');
    };

    document.querySelectorAll('pre').forEach((pre) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.before(wrapper);
        wrapper.appendChild(pre);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-copy';
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code block');
        button.addEventListener('click', async () => {
            try {
                await copyText(pre.textContent || '');
                button.textContent = 'Copied';
                if (copyStatus) copyStatus.textContent = 'Code copied to clipboard.';
            } catch {
                button.textContent = 'Copy failed';
                if (copyStatus) copyStatus.textContent = 'Code could not be copied.';
            }
            window.setTimeout(() => { button.textContent = 'Copy'; }, 1800);
        });
        wrapper.appendChild(button);
    });
})();
