// Error logging utility
const Logger = {
    error: (component, message, error) => {
        console.error(`[ERROR] ${component}: ${message}`, error);
    },
    warn: (component, message) => {
        console.warn(`[WARN] ${component}: ${message}`);
    },
    info: (component, message) => {
        console.info(`[INFO] ${component}: ${message}`);
    }
};

const SUPABASE_PUBLIC_URL = 'https://eaiwhqqwirahmppfjsva.supabase.co';
const SUPABASE_PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJlYWl3aHFxd2lyYWhtcHBmanN2YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1ODk5NTM0LCJleHAiOjIwOTE0NzU1MzR9.WRLIyYQDuLn5k8XKuiv4SfUdh1qkFwSimT1fvP06VGU';

function normalizePageKey(value) {
    let path = String(value || '');

    if (!path) {
        return 'index';
    }

    if (/^https?:/i.test(path)) {
        try {
            path = new URL(path).pathname;
        } catch {
            path = String(value || '');
        }
    }

    path = path.split('?')[0].split('#')[0].replace(/\\/g, '/');
    const lastSegment = path.split('/').filter(Boolean).pop() || 'index';
    const normalized = lastSegment.replace(/\.html$/i, '');
    return normalized || 'index';
}

function toCleanInternalPath(href, relativePrefix = '') {
    const rawHref = String(href || '').trim();

    if (!rawHref || /^([a-z]+:|#)/i.test(rawHref) || rawHref.startsWith('//')) {
        return rawHref;
    }

    const [pathWithQuery, hashValue] = rawHref.split('#');
    const [pathOnly, queryValue] = pathWithQuery.split('?');
    const hash = hashValue ? `#${hashValue}` : '';
    const query = queryValue ? `?${queryValue}` : '';
    const hasLeadingSlash = pathOnly.startsWith('/');
    const hasRelativeDots = /^\.?\.?\//.test(pathOnly);

    let normalizedPath = pathOnly;
    if (/index\.html$/i.test(normalizedPath)) {
        normalizedPath = normalizedPath.replace(/index\.html$/i, '');
    } else {
        normalizedPath = normalizedPath.replace(/\.html$/i, '');
    }

    const prefix = hasLeadingSlash || hasRelativeDots ? '' : relativePrefix;
    const nextPath = `${prefix}${normalizedPath}`;
    const fallbackPath = hasLeadingSlash ? '/' : (relativePrefix || '/');

    return `${nextPath || fallbackPath}${query}${hash}`;
}

function normalizeCurrentCleanUrl() {
    if (!/^https?:$/i.test(window.location.protocol)) {
        return;
    }

    const url = new URL(window.location.href);
    let nextPath = url.pathname;

    if (/\/index\.html$/i.test(nextPath)) {
        nextPath = nextPath.replace(/\/index\.html$/i, '/');
    } else if (/\.html$/i.test(nextPath)) {
        nextPath = nextPath.replace(/\.html$/i, '');
    }

    if (nextPath !== url.pathname) {
        url.pathname = nextPath;
        window.history.replaceState({}, document.title, url.toString());
    }
}

document.addEventListener('DOMContentLoaded', function() {
    Logger.info('App', 'Application initializing...');
    normalizeCurrentCleanUrl();

    function syncResponsiveDisclosures() {
        const mobileViewport = window.innerWidth <= 768;
        document.querySelectorAll('.consultation-trust-panel-toggle').forEach((details) => {
            if (!(details instanceof HTMLDetailsElement)) {
                return;
            }

            details.open = !mobileViewport;
        });
    }

    // ========== NAVIGATION COMPONENT ==========
    try {
        const navbar = document.querySelector('.navbar');
        const mobileToggle = document.querySelector('.mobile-toggle');
        const navLinks = document.querySelector('.nav-links');
        const brandWrapper = document.querySelector('.header-logo-wrapper');
        const currentPath = normalizePageKey(window.location.pathname);
        const currentUrl = new URL(window.location.href);
        const currentDemo = currentUrl.searchParams.get('demo') || '';
        const isClientUtilityPage = ['client-login', 'client-portal', 'client-workspace', 'ops-suite'].includes(currentPath);
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const pathDepth = Math.max(pathSegments.length - 1, 0);
        const relativePrefix = '../'.repeat(pathDepth);
        const NAV_COLLAPSE_WIDTH = 1220;
        let menuOverlay = null;

        if (!navbar || !navLinks || !mobileToggle) {
            Logger.info('Navigation', 'Premium navigation skipped on this page');
        } else {
            if (brandWrapper && !brandWrapper.dataset.brandReady) {
                brandWrapper.dataset.brandReady = 'true';
                brandWrapper.innerHTML = `
                    <a href="${resolveHref('index.html')}" class="brand-lockup" aria-label="Architech Designs home">
                        <span class="brand-lockup-mark">
                            <img src="${resolveHref('images/updated-ad-logo.png')}" alt="" aria-hidden="true">
                        </span>
                        <span class="brand-lockup-copy">
                            <strong>Architech Designs</strong>
                            <small>Premium Websites &amp; Systems</small>
                        </span>
                    </a>
                `;
            }

            function resolveHref(href) {
                return /^https?:/i.test(href) ? href : toCleanInternalPath(href, relativePrefix);
            }

            const navigationModel = [
                {
                    type: 'dropdown',
                    label: 'Services',
                    panelClass: 'nav-dropdown-menu-wide',
                    match: ['services.html', 'packages.html'],
                    items: [
                        { label: 'Luxury Websites', href: 'services.html' },
                        { label: 'Packages & Pricing', href: 'packages.html' },
                        { label: 'Client Portal', href: 'client-portal.html' },
                        { label: 'Custom Integrations', href: 'index.html#systems-preview' },
                        { label: 'Redesigns', href: 'services.html' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'Systems',
                    panelClass: 'nav-dropdown-menu-wide nav-dropdown-menu-system',
                    match: ['client-portal.html', 'client-login.html', 'client-workspace.html'],
                    items: [
                        { label: 'Client Portal', href: 'client-portal.html' },
                        { label: 'Automations', href: 'index.html#systems-preview' },
                        { label: 'Estimators & Tools', href: 'portfolio.html#builder-lab' },
                        { label: 'Booking Flows', href: 'index.html#home-consultation' },
                        { label: 'Lead Routing', href: 'portfolio.html#builder-lab' },
                        { label: 'Internal Workflow Tools', href: 'index.html#systems-preview' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'Work',
                    panelClass: 'nav-dropdown-menu-wide',
                    match: ['portfolio.html', 'live-demo.html', 'client-portal.html', 'quiz.html', 'demo-details.html'],
                    items: [
                        { label: 'Demo Sites', href: 'portfolio.html#demo-gallery' },
                        { label: 'Estimator / Calculator', href: 'portfolio.html#builder-lab' },
                        { label: 'Demo Portal', href: 'client-portal.html' },
                        { label: 'Quiz', href: 'quiz.html' },
                        { label: 'Booking System', href: 'index.html#home-consultation' }
                    ]
                },
                {
                    type: 'dropdown',
                    label: 'About',
                    panelClass: 'nav-dropdown-menu-compact',
                    match: ['about.html', 'process.html', 'faq.html', 'contact.html', 'why-choose-us.html'],
                    items: [
                        { label: 'About', href: 'about.html' },
                        { label: 'Process', href: 'process.html' },
                        { label: 'Contact', href: 'contact.html' }
                    ]
                }
            ];

            function isItemActive(item) {
                if (item.match && item.match.includes(currentPath)) {
                    return true;
                }

                if (item.match && item.match.map(normalizePageKey).includes(currentPath)) {
                    return true;
                }

                if (item.type === 'dropdown') {
                    return item.items.some((entry) => {
                        const parsed = new URL(entry.href, window.location.origin + '/');
                        const path = normalizePageKey(parsed.pathname);
                        const demo = parsed.searchParams.get('demo') || '';
                        return path === currentPath && (!demo || demo === currentDemo);
                    });
                }

                return normalizePageKey(item.href) === currentPath;
            }

            function renderNavItem(item) {
                const activeClass = isItemActive(item) ? ' is-current' : '';

                if (item.type === 'dropdown') {
                    return `
                        <li class="nav-item nav-dropdown${activeClass}">
                            <button class="nav-link nav-dropdown-toggle" type="button" aria-expanded="false">
                                <span>${item.label}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div class="nav-dropdown-menu ${item.panelClass || ''}">
                                ${item.items.map((entry) => `
                                    <a href="${resolveHref(entry.href)}" class="nav-dropdown-link${isItemActive({ type: 'dropdown', items: [entry] }) ? ' active' : ''}">
                                        <strong>${entry.label}</strong>
                                    </a>
                                `).join('')}
                            </div>
                        </li>
                    `;
                }

                return `
                    <li class="nav-item${activeClass}">
                        <a href="${resolveHref(item.href)}" class="nav-link">${item.label}</a>
                    </li>
                `;
            }

            function closeMenu() {
                navLinks.classList.remove('active');
                mobileToggle.classList.remove('active');
                menuOverlay?.classList.remove('active');
                document.body.classList.remove('nav-open');
                document.body.style.overflow = '';
                document.querySelectorAll('.nav-dropdown.is-open').forEach((item) => {
                    item.classList.remove('is-open');
                    item.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                });
            }

            function openMenu() {
                navLinks.classList.add('active');
                mobileToggle.classList.add('active');
                menuOverlay?.classList.add('active');
                document.body.classList.add('nav-open');
                document.body.style.overflow = 'hidden';
            }

            function toggleMenu() {
                if (navLinks.classList.contains('active')) {
                    closeMenu();
                } else {
                    openMenu();
                }
            }

            function renderNavigation() {
                navLinks.innerHTML = [
                    ...navigationModel.map(renderNavItem),
                    `<li class="nav-mobile-action"><a href="${resolveHref('client-login.html')}" class="nav-mobile-link nav-mobile-link-subtle${isClientUtilityPage ? ' active' : ''}">Client Login</a></li>`,
                    `<li class="nav-mobile-action nav-mobile-action-primary"><a href="${resolveHref('contact.html')}" class="nav-mobile-link">Book Consultation</a></li>`
                ].join('');

                const navCta = document.querySelector('.nav-cta');
                if (navCta) {
                    navCta.innerHTML = `
                        <a href="${resolveHref('client-login.html')}" class="nav-utility-link${isClientUtilityPage ? ' active' : ''}">Client Login</a>
                        <a href="${resolveHref('contact.html')}" class="btn btn-sm nav-primary-cta">Book Consultation</a>
                    `;
                }

                navbar.classList.add('navbar-premium');
            }

            renderNavigation();

            if (!document.querySelector('.menu-overlay')) {
                menuOverlay = document.createElement('button');
                menuOverlay.type = 'button';
                menuOverlay.className = 'menu-overlay';
                menuOverlay.setAttribute('aria-label', 'Close navigation menu');
                document.body.appendChild(menuOverlay);
            } else {
                menuOverlay = document.querySelector('.menu-overlay');
            }

            window.addEventListener('scroll', function() {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            });

            mobileToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleMenu();
            });

            navLinks.addEventListener('click', function(e) {
                const dropdownTrigger = e.target.closest('.nav-dropdown-toggle');
                if (dropdownTrigger && window.innerWidth <= NAV_COLLAPSE_WIDTH) {
                    const parent = dropdownTrigger.closest('.nav-dropdown');
                    const isOpen = parent.classList.contains('is-open');
                    document.querySelectorAll('.nav-dropdown.is-open').forEach((item) => {
                        item.classList.remove('is-open');
                        item.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                    });
                    parent.classList.toggle('is-open', !isOpen);
                    dropdownTrigger.setAttribute('aria-expanded', String(!isOpen));
                    return;
                }

                if (e.target.closest('a')) {
                    closeMenu();
                }
            });

            menuOverlay?.addEventListener('click', closeMenu);

            document.addEventListener('click', function(e) {
                if (navLinks.classList.contains('active') &&
                    !navLinks.contains(e.target) &&
                    !mobileToggle.contains(e.target)) {
                    closeMenu();
                }
            });

            window.addEventListener('resize', function() {
                if (window.innerWidth > NAV_COLLAPSE_WIDTH) {
                    closeMenu();
                }
            });

            Logger.info('Navigation', 'Mobile toggle initialized');
        }
    } catch (e) {
        Logger.error('Navigation', 'Failed to initialize navigation', e);
    }

    syncResponsiveDisclosures();
    window.addEventListener('resize', syncResponsiveDisclosures);

    document.querySelectorAll('a[href]').forEach((anchor) => {
        const rawHref = anchor.getAttribute('href');
        if (!rawHref || /^([a-z]+:|#|\/\/)/i.test(rawHref)) {
            return;
        }

        anchor.setAttribute('href', toCleanInternalPath(rawHref));
    });

    // ========== HONEST SOCIAL LINKS ==========
    try {
        document.querySelectorAll('[aria-label="LinkedIn"]').forEach((link) => {
            link.href = 'https://www.linkedin.com/company/architechdesigns';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });

        ['Twitter', 'Instagram'].forEach((label) => {
            document.querySelectorAll(`[aria-label="${label}"]`).forEach((link) => {
                link.setAttribute('aria-hidden', 'true');
                link.hidden = true;
            });
        });
    } catch (e) {
        Logger.error('Social', 'Failed to normalize social links', e);
    }

    // ========== SMOOTH SCROLL COMPONENT ==========
    try {
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    const navbar = document.querySelector('.navbar');
                    const headerOffset = navbar ? navbar.offsetHeight + 24 : 24;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                } else {
                    Logger.warn('SmoothScroll', `Target not found: ${this.getAttribute('href')}`);
                }
            });
        });
        Logger.info('SmoothScroll', `Initialized for ${anchorLinks.length} anchor links`);
    } catch (e) {
        Logger.error('SmoothScroll', 'Failed to initialize smooth scroll', e);
    }

    // ========== SCROLL REVEAL COMPONENT ==========
    try {
        const revealElements = document.querySelectorAll('.reveal');
        
        if (revealElements.length === 0) {
            Logger.warn('ScrollReveal', 'No elements with .reveal class found');
        }
        
        function checkReveal() {
            const windowHeight = window.innerHeight;
            const revealPoint = 150;
            
            revealElements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top;
                if (elementTop < windowHeight - revealPoint) {
                    element.classList.add('active');
                }
            });
        }
        
        window.addEventListener('scroll', checkReveal);
        window.addEventListener('load', checkReveal);
        window.addEventListener('hashchange', checkReveal);
        checkReveal();
        window.setTimeout(checkReveal, 120);
        Logger.info('ScrollReveal', `Watching ${revealElements.length} elements`);
    } catch (e) {
        Logger.error('ScrollReveal', 'Failed to initialize scroll reveal', e);
    }

    // ========== FAQ ACCORDION COMPONENT ==========
    try {
        const faqItems = document.querySelectorAll('.faq-item');
        
        if (faqItems.length === 0) {
            Logger.warn('FAQ', 'No FAQ items found on this page');
        }
        
        faqItems.forEach((item, index) => {
            const question = item.querySelector('.faq-question');
            if (!question) {
                Logger.warn('FAQ', `FAQ item ${index} missing .faq-question element`);
                return;
            }
            
            question.addEventListener('click', function() {
                const isActive = item.classList.contains('active');
                faqItems.forEach(otherItem => otherItem.classList.remove('active'));
                if (!isActive) item.classList.add('active');
            });
        });
        Logger.info('FAQ', `Initialized ${faqItems.length} FAQ items`);
    } catch (e) {
        Logger.error('FAQ', 'Failed to initialize FAQ accordion', e);
    }

    // ========== ANIMATED COUNTERS COMPONENT ==========
    try {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        function animateCounters() {
            statNumbers.forEach(stat => {
                if (stat.dataset.animated === 'true') {
                    return;
                }

                const target = parseInt(stat.getAttribute('data-target'));
                if (isNaN(target)) {
                    Logger.warn('Counter', 'Invalid data-target value');
                    return;
                }
                
                const duration = 2000;
                const step = target / (duration / 16);
                let current = 0;
                
                const updateCounter = () => {
                    current += step;
                    if (current < target) {
                        stat.textContent = Math.floor(current);
                        requestAnimationFrame(updateCounter);
                    } else {
                        stat.textContent = target;
                    }
                };
                
                const statCard = stat.closest('.stat-card');
                if (statCard) {
                    const statTop = statCard.getBoundingClientRect().top;
                    const windowHeight = window.innerHeight;
                    if (statTop < windowHeight - 100) {
                        stat.dataset.animated = 'true';
                        updateCounter();
                    }
                }
            });
        }
        
        window.addEventListener('scroll', animateCounters);
        animateCounters();
        Logger.info('Counter', `Watching ${statNumbers.length} counter elements`);
    } catch (e) {
        Logger.error('Counter', 'Failed to initialize animated counters', e);
    }

    // ========== PORTFOLIO FILTER COMPONENT ==========
    try {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const projectCards = document.querySelectorAll('.project-card');
        
        if (filterButtons.length > 0) {
            filterButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const filter = this.getAttribute('data-filter');
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    projectCards.forEach(card => {
                        const category = card.getAttribute('data-category');
                        if (filter === 'all' || category === filter) {
                            card.style.display = 'block';
                            setTimeout(() => {
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, 10);
                        } else {
                            card.style.opacity = '0';
                            card.style.transform = 'translateY(20px)';
                            setTimeout(() => { card.style.display = 'none'; }, 300);
                        }
                    });
                });
            });
            Logger.info('PortfolioFilter', `Initialized with ${filterButtons.length} buttons`);
        }
    } catch (e) {
        Logger.error('PortfolioFilter', 'Failed to initialize portfolio filter', e);
    }

    // ========== CONTACT FORM COMPONENT ==========
    try {
        const contactForms = Array.from(document.querySelectorAll('form[data-consultation-form="true"], .contact-form form'));
        const uniqueContactForms = [...new Set(contactForms)];
        
        uniqueContactForms.forEach((contactForm) => {
            let status = contactForm.querySelector('[data-contact-status]');
            const isConsultationForm = contactForm.dataset.consultationForm === 'true';
            if (!status) {
                status = document.createElement('div');
                status.className = 'contact-form-status';
                status.setAttribute('aria-live', 'polite');
                status.dataset.contactStatus = 'true';
                contactForm.appendChild(status);
            }

            function setContactStatus(message, kind = 'info') {
                status.textContent = message;
                status.classList.remove('success', 'error');
                if (kind === 'success') {
                    status.classList.add('success');
                }
                if (kind === 'error') {
                    status.classList.add('error');
                }
            }

            function isLocalPreview() {
                return ['localhost', '127.0.0.1'].includes(window.location.hostname);
            }

            function formatDateValue(date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            function initConsultationScheduler(form) {
                const dayContainer = form.querySelector('[data-consultation-days]');
                const timeContainer = form.querySelector('[data-consultation-times]');
                const daySelect = form.querySelector('[data-consultation-day-select]');
                const timeSelect = form.querySelector('[data-consultation-time-select]');
                const summary = form.querySelector('[data-consultation-summary]');
                const summaryInline = form.querySelector('[data-consultation-summary-inline]');
                const timezoneLabel = form.querySelector('[data-consultation-timezone-label]');
                const schedulerDetails = form.querySelector('.consultation-scheduler');
                const schedulerPanel = form.querySelector('.consultation-scheduler-panel');
                const schedulerSelects = form.querySelector('.consultation-scheduler-selects');
                const hiddenDate = form.querySelector('#consultationDate');
                const hiddenTime = form.querySelector('#consultationTime');
                const hiddenIso = form.querySelector('#consultationIso');
                const hiddenTimezone = form.querySelector('#consultationTimezone');

                if (!summary || !hiddenDate || !hiddenTime || !hiddenIso || !hiddenTimezone) {
                    return null;
                }

                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
                const timezoneDisplay = timezone.replace(/_/g, ' ').replace(/\//g, ' / ');
                const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
                const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
                const summaryFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                const slotOptions = [
                    { value: '09:30', label: '9:30 AM' },
                    { value: '10:00', label: '10:00 AM' },
                    { value: '11:30', label: '11:30 AM' },
                    { value: '12:00', label: '12:00 PM' },
                    { value: '12:30', label: '12:30 PM' },
                    { value: '13:30', label: '1:30 PM' },
                    { value: '14:00', label: '2:00 PM' },
                    { value: '15:00', label: '3:00 PM' },
                    { value: '16:30', label: '4:30 PM' },
                    { value: '17:00', label: '5:00 PM' }
                ];

                const dayOptions = [];
                const cursor = new Date();
                cursor.setHours(0, 0, 0, 0);
                while (dayOptions.length < 8) {
                    cursor.setDate(cursor.getDate() + 1);
                    const weekday = cursor.getDay();
                    if (weekday === 0 || weekday === 6) {
                        continue;
                    }
                    dayOptions.push(new Date(cursor));
                }

                const slotPatterns = [
                    ['09:30', '10:00', '11:30', '13:30', '16:30'],
                    ['10:00', '11:30', '14:00', '15:00', '17:00'],
                    ['09:30', '11:30', '13:30', '15:00', '16:30'],
                    ['10:00', '12:00', '14:00', '15:00', '17:00'],
                    ['09:30', '10:00', '13:30', '15:00', '16:30'],
                    ['10:00', '11:30', '12:30', '14:00', '16:30'],
                    ['09:30', '11:30', '13:30', '15:00', '17:00'],
                    ['10:00', '12:00', '14:00', '16:30', '17:00']
                ];

                const slotsByDay = Object.fromEntries(dayOptions.map((day, index) => {
                    const value = formatDateValue(day);
                    const allowedSlots = slotPatterns[index % slotPatterns.length];
                    return [value, slotOptions.filter((slot) => allowedSlots.includes(slot.value))];
                }));

                function getSlotsForSelectedDay() {
                    return slotsByDay[schedulerState.selectedDay] || slotOptions;
                }

                const schedulerState = {
                    selectedDay: formatDateValue(dayOptions[0]),
                    selectedTime: (slotsByDay[formatDateValue(dayOptions[0])] || slotOptions)[0].value
                };

                if (timezoneLabel) {
                    timezoneLabel.textContent = timezoneDisplay;
                }

                function syncSelection() {
                    const day = dayOptions.find((entry) => formatDateValue(entry) === schedulerState.selectedDay) || dayOptions[0];
                    const availableSlots = getSlotsForSelectedDay();
                    const slot = availableSlots.find((entry) => entry.value === schedulerState.selectedTime) || availableSlots[0];
                    schedulerState.selectedTime = slot.value;
                    const fullSummary = `${summaryFormatter.format(day)} at ${slot.label}`;
                    const compactSummary = `${dayFormatter.format(day)}, ${dateFormatter.format(day)} at ${slot.label}`;

                    hiddenDate.value = schedulerState.selectedDay;
                    hiddenTime.value = slot.label;
                    hiddenIso.value = `${schedulerState.selectedDay}T${slot.value}:00`;
                    hiddenTimezone.value = timezone;
                    summary.textContent = `Requested slot: ${fullSummary} (${timezoneDisplay}).`;

                    if (summaryInline) {
                        summaryInline.textContent = `${compactSummary} (${timezoneDisplay})`;
                    }

                    if (daySelect) {
                        daySelect.value = schedulerState.selectedDay;
                    }

                    if (timeSelect) {
                        timeSelect.value = schedulerState.selectedTime;
                    }
                }

                function renderDays() {
                    if (dayContainer) {
                        dayContainer.innerHTML = dayOptions.map((day) => {
                            const value = formatDateValue(day);
                            const activeClass = value === schedulerState.selectedDay ? ' is-active' : '';
                            return `
                                <button type="button" class="consultation-day${activeClass}" data-consultation-day="${value}">
                                    <strong>${dayFormatter.format(day)}</strong>
                                    <span>${dateFormatter.format(day)}</span>
                                </button>
                            `;
                        }).join('');
                    }

                    if (daySelect) {
                        daySelect.innerHTML = dayOptions.map((day) => {
                            const value = formatDateValue(day);
                            return `<option value="${value}">${dayFormatter.format(day)} - ${dateFormatter.format(day)}</option>`;
                        }).join('');
                    }
                }

                function renderTimes() {
                    const availableSlots = getSlotsForSelectedDay();
                    if (timeContainer) {
                        timeContainer.innerHTML = availableSlots.map((slot) => {
                            const activeClass = slot.value === schedulerState.selectedTime ? ' is-active' : '';
                            return `
                                <button type="button" class="consultation-slot${activeClass}" data-consultation-time="${slot.value}">
                                    <strong>${slot.label}</strong>
                                </button>
                            `;
                        }).join('');
                    }

                    if (timeSelect) {
                        timeSelect.innerHTML = availableSlots.map((slot) => `
                            <option value="${slot.value}">${slot.label}</option>
                        `).join('');
                    }
                }

                function syncSchedulerPresentation() {
                    const homepageScheduler = schedulerDetails?.classList.contains('home-consultation-scheduler');
                    if (!homepageScheduler) {
                        return;
                    }

                    const mobileViewport = window.innerWidth <= 768;

                    if (schedulerDetails) {
                        schedulerDetails.style.setProperty('display', 'grid', 'important');
                        schedulerDetails.style.setProperty('overflow', 'visible', 'important');
                    }

                    if (schedulerPanel) {
                        schedulerPanel.style.setProperty('display', 'grid', 'important');
                    }

                    if (dayContainer) {
                        dayContainer.style.setProperty('display', 'none', 'important');
                    }

                    if (timeContainer) {
                        timeContainer.style.setProperty('display', 'none', 'important');
                    }

                    if (schedulerSelects) {
                        schedulerSelects.style.setProperty('display', 'grid', 'important');
                        schedulerSelects.style.setProperty('grid-template-columns', mobileViewport ? '1fr' : 'repeat(2, minmax(0, 1fr))');
                    }
                }

                dayContainer?.addEventListener('click', (event) => {
                    const trigger = event.target.closest('[data-consultation-day]');
                    if (!trigger) {
                        return;
                    }

                    schedulerState.selectedDay = trigger.dataset.consultationDay;
                    schedulerState.selectedTime = getSlotsForSelectedDay()[0].value;
                    renderDays();
                    renderTimes();
                    syncSelection();
                });

                timeContainer?.addEventListener('click', (event) => {
                    const trigger = event.target.closest('[data-consultation-time]');
                    if (!trigger) {
                        return;
                    }

                    schedulerState.selectedTime = trigger.dataset.consultationTime;
                    renderTimes();
                    syncSelection();
                });

                daySelect?.addEventListener('change', (event) => {
                    schedulerState.selectedDay = event.target.value;
                    schedulerState.selectedTime = getSlotsForSelectedDay()[0].value;
                    renderDays();
                    renderTimes();
                    syncSelection();
                });

                timeSelect?.addEventListener('change', (event) => {
                    schedulerState.selectedTime = event.target.value;
                    renderTimes();
                    syncSelection();
                });

                renderDays();
                renderTimes();
                syncSelection();
                syncSchedulerPresentation();

                if (schedulerDetails && !schedulerDetails.dataset.schedulerResizeBound) {
                    schedulerDetails.dataset.schedulerResizeBound = 'true';
                    window.addEventListener('resize', syncSchedulerPresentation);
                }

                return {
                    isValid: () => Boolean(hiddenDate.value && hiddenTime.value),
                    reset() {
                        schedulerState.selectedDay = formatDateValue(dayOptions[0]);
                        schedulerState.selectedTime = getSlotsForSelectedDay()[0].value;
                        renderDays();
                        renderTimes();
                        syncSelection();
                    }
                };
            }

            async function submitToFormspree(form) {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: {
                        Accept: 'application/json'
                    }
                });

                return {
                    ok: response.ok,
                    status: response.status
                };
            }

            async function submitConsultationRequest(form) {
                const payload = {
                    fullName: [form.querySelector('#firstName')?.value.trim(), form.querySelector('#lastName')?.value.trim()].filter(Boolean).join(' '),
                    email: form.querySelector('#email')?.value.trim().toLowerCase(),
                    phone: form.querySelector('#phone')?.value.trim() || '',
                    companyName: form.querySelector('#businessName')?.value.trim(),
                    requestedService: form.querySelector('#package')?.value || '',
                    budgetRange: form.querySelector('#budget')?.value || '',
                    timeline: form.querySelector('#timeline')?.value || '',
                    preferredDate: form.querySelector('#consultationDate')?.value || '',
                    preferredTime: form.querySelector('#consultationTime')?.value || '',
                    preferredIso: form.querySelector('#consultationIso')?.value || '',
                    timezone: form.querySelector('#consultationTimezone')?.value || '',
                    projectDetails: form.querySelector('#projectDetails')?.value.trim(),
                    source: 'website-contact-scheduler'
                };

                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    body: JSON.stringify(payload)
                };

                async function parseConsultationResponse(response) {
                    let body = {};
                    try {
                        body = await response.json();
                    } catch (parseError) {
                        body = {};
                    }

                    return {
                        ok: response.ok,
                        skipped: false,
                        status: response.status,
                        message: body.message || ''
                    };
                }

                try {
                    const response = await fetch(`${SUPABASE_PUBLIC_URL}/functions/v1/contact-consultation`, {
                        ...requestOptions,
                        headers: {
                            ...requestOptions.headers,
                            apikey: SUPABASE_PUBLIC_ANON_KEY
                        }
                    });
                    const result = await parseConsultationResponse(response);

                    if (response.ok || ![404, 405, 503].includes(response.status)) {
                        return result;
                    }

                    const fallbackResponse = await fetch('/api/contact-consultation', requestOptions);

                    return await parseConsultationResponse(fallbackResponse);
                } catch (error) {
                    try {
                        const fallbackResponse = await fetch('/api/contact-consultation', requestOptions);

                        return await parseConsultationResponse(fallbackResponse);
                    } catch (fallbackError) {
                        return {
                            ok: false,
                            skipped: isLocalPreview(),
                            status: 0,
                            message: fallbackError.message || error.message || 'The consultation request could not be saved.'
                        };
                    };
                }
            }

            const consultationScheduler = isConsultationForm ? initConsultationScheduler(contactForm) : null;

            contactForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.textContent : 'Send';
                
                let isValid = true;
                const requiredFields = contactForm.querySelectorAll('[required]');
                
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        isValid = false;
                        field.style.borderColor = 'var(--error)';
                    } else {
                        field.style.borderColor = 'var(--border)';
                    }
                });

                if (isConsultationForm && consultationScheduler && !consultationScheduler.isValid()) {
                    isValid = false;
                }
                
                if (isValid && submitBtn) {
                    submitBtn.textContent = isConsultationForm ? 'Reserving...' : 'Sending...';
                    submitBtn.disabled = true;
                    setContactStatus(
                        isConsultationForm ? 'Saving your preferred consultation time and sending your brief...' : 'Sending your inquiry...',
                        'info'
                    );
                    
                    try {
                        let consultationResult = { ok: true, skipped: false, status: 200, message: '' };
                        if (isConsultationForm) {
                            consultationResult = await submitConsultationRequest(contactForm);
                            if (!consultationResult.ok && !consultationResult.skipped && consultationResult.status === 409) {
                                submitBtn.textContent = originalText;
                                submitBtn.disabled = false;
                                setContactStatus(consultationResult.message || 'That consultation slot was just taken. Choose a different time and try again.', 'error');
                                return;
                            }
                        }

                        const emailResult = await submitToFormspree(contactForm);
                        
                        if (consultationResult.ok && emailResult.ok) {
                            submitBtn.textContent = isConsultationForm ? 'Consultation Requested' : 'Message Sent';
                            submitBtn.style.background = 'var(--success)';
                            submitBtn.style.color = 'var(--white)';
                            contactForm.reset();
                            consultationScheduler?.reset();
                            setContactStatus(
                                isConsultationForm
                                    ? 'Your consultation request is in. The preferred time is saved to the admin calendar and the team has your brief.'
                                    : 'Your message was sent successfully. We will reach out soon.',
                                'success'
                            );
                            Logger.info('ContactForm', 'Consultation request saved and emailed successfully');
                        } else if (consultationResult.ok && !emailResult.ok) {
                            submitBtn.textContent = 'Request Saved';
                            submitBtn.style.background = 'var(--success)';
                            submitBtn.style.color = 'var(--white)';
                            contactForm.reset();
                            consultationScheduler?.reset();
                            setContactStatus('Your request was saved to the admin calendar. Email forwarding is delayed, but the team will still see it internally.', 'success');
                            Logger.warn('ContactForm', 'Consultation saved but Formspree email failed');
                        } else if (!consultationResult.ok && emailResult.ok) {
                            submitBtn.textContent = 'Inquiry Sent';
                            submitBtn.style.background = 'var(--success)';
                            submitBtn.style.color = 'var(--white)';
                            contactForm.reset();
                            consultationScheduler?.reset();
                            setContactStatus(
                                consultationResult.skipped
                                    ? 'Your inquiry was sent. The admin-calendar handoff is skipped in local preview, but the live site will store it internally.'
                                    : (consultationResult.message || 'Your inquiry was sent. We could not lock the calendar slot automatically, so the team will confirm it manually.'),
                                'success'
                            );
                            Logger.warn('ContactForm', 'Formspree succeeded but consultation calendar save failed');
                        } else {
                            submitBtn.textContent = 'Try Again';
                            setContactStatus('We could not send your message right now. Please try again or email us directly.', 'error');
                            Logger.error('ContactForm', 'Consultation save and Formspree submission failed');
                        }
                    } catch (error) {
                        submitBtn.textContent = 'Try Again';
                        setContactStatus('We could not send your message right now. Please try again or email us directly.', 'error');
                        Logger.error('ContactForm', 'Form submission error: ' + error.message);
                    }
                    
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.background = '';
                        submitBtn.style.color = '';
                        submitBtn.disabled = false;
                    }, 5000);
                } else {
                    setContactStatus('Please complete each required field before sending your message.', 'error');
                    Logger.warn('ContactForm', 'Form validation failed');
                }
            });
            Logger.info('ContactForm', 'Contact form initialized');
        });
    } catch (e) {
        Logger.error('ContactForm', 'Failed to initialize contact form', e);
    }

    // ========== PACKAGE TOGGLE COMPONENT ==========
    try {
        const packageToggles = document.querySelectorAll('.package-toggle');
        
        if (packageToggles.length > 0) {
            packageToggles.forEach(toggle => {
                toggle.addEventListener('click', function() {
                    const isYearly = this.classList.contains('yearly');
                    const prices = document.querySelectorAll('.package-price');
                    
                    prices.forEach(price => {
                        const monthly = price.getAttribute('data-monthly');
                        const yearly = price.getAttribute('data-yearly');
                        
                        if (monthly && yearly) {
                            price.innerHTML = isYearly 
                                ? `$${yearly}<span>/year</span>` 
                                : `$${monthly}<span>/month</span>`;
                        } else {
                            Logger.warn('PackageToggle', 'Missing price data attributes');
                        }
                    });
                });
            });
            Logger.info('PackageToggle', `Initialized ${packageToggles.length} toggles`);
        }
    } catch (e) {
        Logger.error('PackageToggle', 'Failed to initialize package toggle', e);
    }

    // ========== PARALLAX EFFECT COMPONENT ==========
    try {
        const heroSection = document.querySelector('.hero');
        
        if (heroSection) {
            window.addEventListener('scroll', function() {
                const scrolled = window.pageYOffset;
                if (scrolled < heroSection.offsetHeight) {
                    heroSection.style.backgroundPositionY = scrolled * 0.5 + 'px';
                }
            });
            Logger.info('Parallax', 'Parallax effect initialized');
        }
    } catch (e) {
        Logger.error('Parallax', 'Failed to initialize parallax effect', e);
    }

    // ========== LAZY LOAD COMPONENT ==========
    try {
        const lazyImages = document.querySelectorAll('img[data-src]');
        
        function lazyLoad() {
            lazyImages.forEach(img => {
                const rect = img.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                
                if (rect.top < windowHeight - 100) {
                    img.src = img.getAttribute('data-src');
                    img.removeAttribute('data-src');
                }
            });
        }
        
        window.addEventListener('scroll', lazyLoad);
        
        if (lazyImages.length > 0) {
            Logger.info('LazyLoad', `Watching ${lazyImages.length} images for lazy loading`);
        }
    } catch (e) {
        Logger.error('LazyLoad', 'Failed to initialize lazy loading', e);
    }

    // ========== SIMPLE VALUE CALCULATOR ==========
    try {
        const trafficSelect = document.getElementById('traffic-select');
        const leadValueSelect = document.getElementById('lead-value-select');
        const calcResult = document.getElementById('calc-result');

        if (trafficSelect && leadValueSelect && calcResult) {
            function updateCalculator() {
                const traffic = parseInt(trafficSelect.value);
                const leadValue = parseInt(leadValueSelect.value);
                const conversionRate = 0.03;
                const leadsPerMonth = Math.round(traffic * conversionRate);
                const annualValue = leadsPerMonth * leadValue * 12;

                calcResult.textContent = '$' + annualValue.toLocaleString();
            }

            trafficSelect.addEventListener('change', updateCalculator);
            leadValueSelect.addEventListener('change', updateCalculator);
            updateCalculator();
            Logger.info('ValueCalculator', 'Simple website value calculator initialized');
        }
    } catch (e) {
        Logger.error('ValueCalculator', 'Failed to initialize value calculator', e);
    }

    // ========== MOCKUP TAB NAVIGATION ==========
    try {
        const mockupTabs = document.querySelectorAll('.mockup-tab');
        
        if (mockupTabs.length > 0) {
            mockupTabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const page = this.getAttribute('data-page');
                    const container = this.closest('.concept-mockup-section');
                    
                    // Update tab active state
                    container.querySelectorAll('.mockup-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update page view
                    container.querySelectorAll('.mockup-page').forEach(p => p.classList.remove('active'));
                    container.querySelector('#' + page).classList.add('active');
                });
            });
            Logger.info('MockupTabs', `Initialized ${mockupTabs.length} mockup tabs`);
        }
    } catch (e) {
        Logger.error('MockupTabs', 'Failed to initialize mockup tabs', e);
    }

    // ========== GLOBAL ERROR HANDLER ==========
    window.addEventListener('error', function(e) {
        Logger.error('Global', `Unhandled error: ${e.message}`, e.error);
    });

    Logger.info('App', 'Application initialized successfully');

    const cardModal = document.getElementById('cardModal');
    const cardModalOverlay = document.getElementById('cardModalOverlay');
    const cardModalClose = document.getElementById('cardModalClose');
    const cardModalIcon = document.getElementById('cardModalIcon');
    const cardModalTitle = document.getElementById('cardModalTitle');
    let cardModalText = document.getElementById('cardModalText');

    if (cardModal && cardModalOverlay && cardModalClose) {
        if (cardModalText && cardModalText.tagName === 'P') {
            const replacement = document.createElement('div');
            replacement.id = 'cardModalText';
            replacement.className = 'card-modal-copy';
            cardModalText.replaceWith(replacement);
            cardModalText = replacement;
        }

        function escapeHtml(value) {
            return value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function buildCardModalBody(card) {
            const paragraphs = Array.from(card.querySelectorAll('p'))
                .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
                .filter(Boolean);

            const listItems = Array.from(card.querySelectorAll('.package-feature, .why-feature span, .project-metrics span'))
                .map((item) => item.textContent.replace(/\s+/g, ' ').trim())
                .filter(Boolean);

            let html = paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');

            if (listItems.length > 0) {
                html += `<ul class="card-modal-list">${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
            }

            return html;
        }

        function openCardModal(iconHtml, title, bodyHtml) {
            if (cardModalIcon && cardModalTitle && cardModalText) {
                cardModalIcon.innerHTML = iconHtml || '';
                cardModalIcon.style.display = iconHtml ? 'flex' : 'none';
                cardModalTitle.textContent = title;
                cardModalText.innerHTML = bodyHtml;
            }
            cardModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeCardModal() {
            cardModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        cardModalOverlay.addEventListener('click', closeCardModal);
        cardModalClose.addEventListener('click', closeCardModal);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cardModal.classList.contains('active')) {
                closeCardModal();
            }
        });

        const clickableCards = document.querySelectorAll('.service-card, .package-card, .value-card, .who-card, .approach-card, .trust-proof-card, .client-experience-card');
        clickableCards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (window.innerWidth > 768) {
                    return;
                }

                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }

                const icon = this.querySelector('.service-icon, .value-icon, .who-icon');
                const title = this.querySelector('h3, h4');
                const bodyHtml = buildCardModalBody(this);
                
                if (title && bodyHtml) {
                    const iconHtml = icon ? icon.innerHTML : '';
                    openCardModal(iconHtml, title.textContent, bodyHtml);
                }
            });

            card.addEventListener('keydown', function(e) {
                if (window.innerWidth > 768) {
                    return;
                }

                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });

            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
        });
    }

    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('click', function(e) {
            const href = this.dataset.href || this.querySelector('.project-overlay a')?.href;
            if (href) {
                const newTab = this.dataset.newTab === 'true';
                if (newTab) {
                    window.open(href, '_blank');
                } else {
                    window.location.href = href;
                }
            }
        });
        
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const href = this.dataset.href || this.querySelector('.project-overlay a')?.href;
                if (href) {
                    const newTab = this.dataset.newTab === 'true';
                    if (newTab) {
                        window.open(href, '_blank');
                    } else {
                        window.location.href = href;
                    }
                }
            }
        });
        
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
    });

    // ========== WEBSITE QUIZ COMPONENT ==========
    try {
        const quizContainer = document.getElementById('quizContainer');
        
        if (quizContainer) {
            const quizWrapper = document.getElementById('quizWrapper');
            const questions = quizWrapper.querySelectorAll('.quiz-question');
            const quizResults = document.getElementById('quizResults');
            const progressFill = document.getElementById('quizProgressFill');
            const currentQuestionEl = document.getElementById('currentQuestion');
            const totalQuestionsEl = document.getElementById('totalQuestions');
            const quizRetake = document.getElementById('quizRetake');
            const multiSelectKeys = new Set(['primary_goal', 'help_needed']);
            
            let currentStep = 0;
            const totalSteps = questions.length;
            const answers = {};
            
            totalQuestionsEl.textContent = totalSteps;

            function advanceQuiz(index) {
                if (index < totalSteps - 1) {
                    currentStep = index + 1;
                    showQuestion(currentStep);
                } else {
                    showResults();
                }
            }

            function ensureMultiSelectContinue(question) {
                let continueButton = question.querySelector('[data-quiz-continue]');
                if (continueButton) {
                    return continueButton;
                }

                const actions = document.createElement('div');
                actions.className = 'quiz-question-actions';

                continueButton = document.createElement('button');
                continueButton.type = 'button';
                continueButton.className = 'btn btn-primary btn-sm quiz-question-continue';
                continueButton.dataset.quizContinue = 'true';
                continueButton.disabled = true;
                continueButton.textContent = 'Continue';

                actions.appendChild(continueButton);
                question.appendChild(actions);
                return continueButton;
            }
            
            function showQuestion(index) {
                questions.forEach((q, i) => {
                    if (i === index) {
                        q.classList.add('active');
                    } else {
                        q.classList.remove('active');
                    }
                });
                quizResults.classList.remove('active');
                currentQuestionEl.textContent = index + 1;
                updateProgress();
            }
            
            function updateProgress() {
                const progress = ((currentStep + 1) / totalSteps) * 100;
                progressFill.style.width = progress + '%';
                
                const steps = quizContainer.querySelectorAll('.quiz-progress-step');
                steps.forEach((step, i) => {
                    if (i < currentStep) {
                        step.classList.add('completed');
                        step.classList.remove('active');
                    } else if (i === currentStep) {
                        step.classList.add('active');
                        step.classList.remove('completed');
                    } else {
                        step.classList.remove('active', 'completed');
                    }
                });
            }
            
            function showResults() {
                questions.forEach(q => q.classList.remove('active'));
                quizResults.classList.add('active');
                progressFill.style.width = '100%';
                
                const steps = quizContainer.querySelectorAll('.quiz-progress-step');
                steps.forEach(step => {
                    step.classList.add('completed');
                    step.classList.remove('active');
                });
                
                const result = calculateResult();
                displayResult(result);
            }
            
            function calculateResult() {
                const currentPresence = answers.current_presence || 'none';
                const primaryGoal = answers.primary_goal || [];
                const helpNeeded = answers.help_needed || [];
                const budget = answers.budget || '2k_5k';
                
                // Normalize to arrays
                const goals = Array.isArray(primaryGoal) ? primaryGoal : [primaryGoal];
                const needs = Array.isArray(helpNeeded) ? helpNeeded : [helpNeeded];
                
                // Calculate score for each package
                let launchScore = 0;
                let growthScore = 0;
                let premiumScore = 0;
                
                // Current presence scoring
                if (currentPresence === 'none') {
                    launchScore += 3;
                    growthScore += 1;
                } else if (currentPresence === 'outdated') {
                    growthScore += 3;
                    premiumScore += 1;
                } else if (currentPresence === 'basic') {
                    growthScore += 2;
                    launchScore += 1;
                }
                
                // Primary goal scoring
                if (goals.includes('leads')) {
                    growthScore += 3;
                    premiumScore += 1;
                }
                if (goals.includes('sales')) {
                    premiumScore += 3;
                    growthScore += 2;
                }
                if (goals.includes('brand')) {
                    growthScore += 2;
                    premiumScore += 2;
                }
                if (goals.includes('info')) {
                    launchScore += 2;
                    growthScore += 1;
                }
                
                // Help needed scoring
                if (needs.includes('conversions')) {
                    premiumScore += 3;
                    growthScore += 2;
                }
                if (needs.includes('seo')) {
                    growthScore += 2;
                    premiumScore += 2;
                }
                if (needs.includes('design')) {
                    growthScore += 2;
                    launchScore += 1;
                }
                if (needs.includes('mobile')) {
                    launchScore += 1;
                    growthScore += 2;
                }
                if (needs.includes('automation')) {
                    premiumScore += 4;
                    growthScore += 1;
                }
                
                // Budget scoring
                if (budget === 'under_2k') {
                    launchScore += 3;
                } else if (budget === '2k_5k') {
                    growthScore += 2;
                    launchScore += 1;
                } else if (budget === '5k_10k') {
                    growthScore += 3;
                    premiumScore += 1;
                } else if (budget === 'over_10k') {
                    premiumScore += 3;
                }
                
                // Determine winner
                let recommendedPackage = 'growth';
                let description = '';
                let features = [];
                
                const maxScore = Math.max(launchScore, growthScore, premiumScore);
                
                if (premiumScore === maxScore && premiumScore > 0) {
                    recommendedPackage = 'premium';
                    description = 'Best fit when your project needs advanced functionality, integrations, or custom workflow support alongside premium design.';
                    features = [
                        'Discovery and technical scoping',
                        'Custom dashboards, portals, or internal tools',
                        'Integration and automation planning',
                        'Premium front-end design system',
                        'Q&A, launch support, and refinement',
                        'Tailored roadmap based on your workflow needs'
                    ];
                } else if (growthScore === maxScore) {
                    recommendedPackage = 'growth';
                    description = 'Best for businesses that need a premium website with stronger conversion structure, trust architecture, and growth-focused functionality.';
                    features = [
                        'Premium custom website design',
                        'Conversion-focused page structure',
                        'Lead capture and workflow setup',
                        'Advanced SEO and performance baseline',
                        'Analytics and optimization readiness',
                        'Launch support and refinement'
                    ];
                } else {
                    recommendedPackage = 'launch';
                    description = 'Ideal when you need a polished, professional website that elevates your brand and creates a strong first impression.';
                    features = [
                        'Strategic page planning',
                        'Premium responsive front-end design',
                        'Lead capture and contact flow',
                        'Performance and SEO baseline',
                        'Launch-ready structure and support'
                    ];
                }
                
                return {
                    package: recommendedPackage,
                    description: description,
                    features: features
                };
            }
            
            function displayResult(result) {
                const packageEl = document.getElementById('quizResultsPackage');
                const descriptionEl = document.getElementById('quizResultsDescription');
                const featuresEl = document.getElementById('quizResultsFeatures');
                
                const packageNames = {
                    'launch': { name: 'Launch Site', subtitle: 'Focused Website Engagement' },
                    'growth': { name: 'Growth System', subtitle: 'Conversion-Led Build' },
                    'premium': { name: 'Premium Growth System', subtitle: 'Advanced Website + Systems Layer' }
                };
                
                const pkg = packageNames[result.package];
                
                packageEl.innerHTML = `
                    <h4>${pkg.name}</h4>
                    <span>${pkg.subtitle}</span>
                `;
                
                descriptionEl.textContent = result.description;
                
                featuresEl.innerHTML = `
                    <h5>What's Included:</h5>
                    <ul>
                        ${result.features.map(f => `
                            <li>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                ${f}
                            </li>
                        `).join('')}
                    </ul>
                `;
            }
            
            questions.forEach((question, qIndex) => {
                const options = question.querySelectorAll('.quiz-option');
                const key = question.dataset.key;
                const isMultiSelect = multiSelectKeys.has(key);
                const continueButton = isMultiSelect ? ensureMultiSelectContinue(question) : null;

                if (isMultiSelect) {
                    const subtitle = question.querySelector('.quiz-question-subtitle');
                    if (subtitle && !subtitle.textContent.includes('continue')) {
                        subtitle.textContent = 'Select all that apply, then continue';
                    }

                    continueButton?.addEventListener('click', function() {
                        if (!Array.isArray(answers[key]) || answers[key].length === 0) {
                            return;
                        }
                        advanceQuiz(qIndex);
                    });
                }
                
                options.forEach(option => {
                    option.addEventListener('click', function() {
                        if (isMultiSelect) {
                            this.classList.toggle('selected');

                            const selectedValues = [];
                            options.forEach(o => {
                                if (o.classList.contains('selected')) {
                                    selectedValues.push(o.dataset.value);
                                }
                            });
                            answers[key] = selectedValues;
                            if (continueButton) {
                                continueButton.disabled = selectedValues.length === 0;
                            }
                        } else {
                            options.forEach(o => o.classList.remove('selected'));
                            this.classList.add('selected');
                            answers[key] = this.dataset.value;
                            
                            setTimeout(() => {
                                advanceQuiz(qIndex);
                            }, 300);
                        }
                    });
                });
            });
            
            quizRetake.addEventListener('click', function() {
                currentStep = 0;
                Object.keys(answers).forEach(key => delete answers[key]);
                quizWrapper.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                quizWrapper.querySelectorAll('[data-quiz-continue]').forEach(button => {
                    button.disabled = true;
                });
                quizWrapper.querySelectorAll('.quiz-progress-step').forEach(s => s.classList.remove('active', 'completed'));
                showQuestion(0);
            });
            
            showQuestion(0);
            Logger.info('Quiz', 'Project fit estimator initialized');
        }
    } catch (e) {
        Logger.error('Quiz', 'Failed to initialize website quiz', e);
    }

    // ========== DEMO PORTAL DROPDOWN MENU ==========
    try {
        const demoMenuTrigger = document.getElementById('demoMenuTrigger');
        const demoMenuDropdown = document.getElementById('demoMenuDropdown');
        
        if (demoMenuTrigger && demoMenuDropdown) {
            const demoMenuLabel = demoMenuTrigger.querySelector('[data-demo-menu-label]') || demoMenuTrigger.querySelector('span');
            const arrow = demoMenuTrigger.querySelector('svg');
            const demoPanels = document.querySelectorAll('.demo-panel');

            function setDemoMenuOpen(isOpen) {
                demoMenuDropdown.hidden = !isOpen;
                demoMenuTrigger.setAttribute('aria-expanded', String(isOpen));

                if (arrow) {
                    arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            }

            function setActiveDemoPanel(tabName, label) {
                demoMenuDropdown.querySelectorAll('.demo-menu-item').forEach((item) => {
                    item.classList.toggle('active', item.dataset.demoTab === tabName);
                });

                demoPanels.forEach((panel) => {
                    panel.classList.toggle('active', panel.dataset.demoPanel === tabName);
                });

                if (demoMenuLabel && label) {
                    demoMenuLabel.textContent = label;
                }
            }

            const activeMenuItem = demoMenuDropdown.querySelector('.demo-menu-item.active');
            if (activeMenuItem) {
                setActiveDemoPanel(activeMenuItem.dataset.demoTab, activeMenuItem.textContent.trim());
            }

            demoMenuTrigger.addEventListener('click', function(e) {
                e.stopPropagation();
                setDemoMenuOpen(demoMenuDropdown.hidden);
            });

            demoMenuDropdown.addEventListener('click', function(e) {
                const menuItem = e.target.closest('.demo-menu-item');
                if (!menuItem) {
                    return;
                }

                e.stopPropagation();
                setActiveDemoPanel(menuItem.dataset.demoTab, menuItem.textContent.trim());
                setDemoMenuOpen(false);
            });

            document.addEventListener('click', function(e) {
                if (!demoMenuDropdown.contains(e.target) && !demoMenuTrigger.contains(e.target)) {
                    setDemoMenuOpen(false);
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    setDemoMenuOpen(false);
                }
            });
            
            Logger.info('DemoPortal', 'Portal dropdown menu initialized');
        }
    } catch (e) {
        Logger.error('DemoPortal', 'Failed to initialize dropdown menu', e);
    }

    // ========== ESTIMATE BUILDER COMPONENT ==========
    try {
        const estimateBuilder = document.getElementById('estimateBuilder');

        if (estimateBuilder) {
            const currency = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
            });

            const rangeOutput = document.getElementById('estimateRange');
            const packageOutput = document.getElementById('estimatePackageRecommendation');
            const summaryOutput = document.getElementById('estimateSummary');
            const featuresOutput = document.getElementById('estimateFeatureList');

            function calculateEstimate() {
                const basePackage = estimateBuilder.querySelector('#estimateBasePackage')?.value || 'growth';
                const pageCount = parseInt(estimateBuilder.querySelector('#estimatePageCount')?.value || '6', 10);
                const wantsPortal = Boolean(estimateBuilder.querySelector('#estimatePortal')?.checked);
                const wantsAutomation = Boolean(estimateBuilder.querySelector('#estimateAutomation')?.checked);
                const wantsSeo = Boolean(estimateBuilder.querySelector('#estimateSeo')?.checked);
                const wantsCopy = Boolean(estimateBuilder.querySelector('#estimateCopy')?.checked);
                const wantsCalculator = Boolean(estimateBuilder.querySelector('#estimateCalculator')?.checked);
                const wantsCommerce = Boolean(estimateBuilder.querySelector('#estimateCommerce')?.checked);

                const packageBase = {
                    launch: 1799,
                    growth: 2999,
                    premium: 5299
                };

                let estimate = packageBase[basePackage] || packageBase.growth;

                if (pageCount > 5) {
                    estimate += (pageCount - 5) * 180;
                }
                if (wantsPortal) {
                    estimate += 1600;
                }
                if (wantsAutomation) {
                    estimate += 900;
                }
                if (wantsSeo) {
                    estimate += 700;
                }
                if (wantsCopy) {
                    estimate += 650;
                }
                if (wantsCalculator) {
                    estimate += 850;
                }
                if (wantsCommerce) {
                    estimate += 1200;
                }

                let recommendedPackage = 'Growth System';
                if (basePackage === 'launch' && estimate < 2600 && !wantsPortal && !wantsCommerce && !wantsCalculator) {
                    recommendedPackage = 'Launch Site';
                }
                if (basePackage === 'premium' || wantsPortal || wantsCommerce || wantsCalculator || estimate >= 5000) {
                    recommendedPackage = 'Premium Growth System';
                }

                const minEstimate = Math.round((estimate * 0.92) / 50) * 50;
                const maxEstimate = Math.round((estimate * 1.12) / 50) * 50;

                const selectedFeatures = [
                    `${pageCount} page scope`,
                    wantsPortal ? 'client portal preview' : null,
                    wantsAutomation ? 'automation / integrations' : null,
                    wantsSeo ? 'advanced SEO setup' : null,
                    wantsCopy ? 'copy structure support' : null,
                    wantsCalculator ? 'interactive calculator or estimator' : null,
                    wantsCommerce ? 'product or checkout flow' : null
                ].filter(Boolean);

                if (rangeOutput) {
                    rangeOutput.textContent = `${currency.format(minEstimate)} - ${currency.format(maxEstimate)}`;
                }
                if (packageOutput) {
                    packageOutput.textContent = recommendedPackage;
                }
                if (summaryOutput) {
                    summaryOutput.textContent = `This planning range reflects a ${pageCount}-page scope${selectedFeatures.length > 1 ? ` with ${selectedFeatures.slice(1).join(', ')}` : ''}.`;
                }
                if (featuresOutput) {
                    featuresOutput.innerHTML = selectedFeatures.map((feature) => `<li>${feature}</li>`).join('');
                }
            }

            estimateBuilder.querySelectorAll('select, input').forEach((field) => {
                field.addEventListener('input', calculateEstimate);
                field.addEventListener('change', calculateEstimate);
            });

            calculateEstimate();
            Logger.info('EstimateBuilder', 'Interactive estimate builder initialized');
        }
    } catch (e) {
        Logger.error('EstimateBuilder', 'Failed to initialize estimate builder', e);
    }
});
