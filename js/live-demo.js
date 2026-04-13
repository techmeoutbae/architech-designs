const DEMO_MAP = {
    'medspa-beauty': {
        title: 'Luxury Med Spa Demo',
        subtitle: 'A premium med spa showcase embedded directly inside the main site, now pointed at the restored medspa-beauty demo bundle for a true multi-page experience.',
        eyebrow: 'Medical Aesthetics Demo',
        toolbarTitle: 'Luxury med spa browser shell',
        fallbackUrl: 'case-study-luxe-med-spa.html',
        caseStudyUrl: 'case-study-luxe-med-spa.html',
        candidates: [
            'medspa-beauty/index.html',
            'medspa-beauty/',
            'medspa-beauty/out/index.html',
            'medspa-beauty/dist/index.html',
            'medspa-beauty/build/index.html'
        ],
        badges: ['Embedded Experience', 'Live Site Bundle', 'Portfolio Demo'],
        note: 'This route now prefers the restored /medspa-beauty/ site bundle, so visitors can move through the real demo pages instead of a placeholder showcase.',
        metaHeadline: 'Show a premium med spa flow without deploying a separate public app',
        metaBody: 'The embedded wrapper keeps the interactive med spa presentation inside your main site while still giving prospects a live, clickable experience.',
        useCaseTitle: 'High-end beauty positioning',
        useCaseBody: 'Perfect for demonstrating treatments, booking paths, customer journeys, and premium service presentation before a client enters the build phase.'
    }
};

const UNPUBLISHED_DEMOS = {
    'sterling-law': {
        label: 'Law Firm Demo',
        title: 'Law firm concept temporarily offline',
        subtitle: 'This concept has been removed from the public website while it is rebuilt to a higher standard.',
        note: 'The law firm concept is intentionally hidden for now and is not part of the live website.',
        metaHeadline: 'Currently unpublished',
        metaBody: 'Only the active med spa demo is being shown publicly right now.',
        useCaseTitle: 'Next step',
        useCaseBody: 'Return to the projects page or open the med spa demo instead.'
    }
};

const DEFAULT_DEMO_KEY = 'medspa-beauty';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const demoKey = params.get('demo') || DEFAULT_DEMO_KEY;
    const config = DEMO_MAP[demoKey];

    if (config) {
        applyDemoCopy(config);
        await mountDemo(config);
        return;
    }

    if (UNPUBLISHED_DEMOS[demoKey]) {
        renderUnavailableDemo(UNPUBLISHED_DEMOS[demoKey]);
        return;
    }

    window.location.replace(`live-demo.html?demo=${encodeURIComponent(DEFAULT_DEMO_KEY)}`);
});

function applyDemoCopy(config) {
    document.title = `${config.title} | Live Demo | Architech Designs`;

    byId('demoEyebrow').textContent = config.eyebrow;
    byId('demoTitle').textContent = config.title;
    byId('demoSubtitle').textContent = config.subtitle;
    byId('demoToolbarTitle').textContent = config.toolbarTitle;
    byId('demoMetaHeadline').textContent = config.metaHeadline;
    byId('demoMetaBody').textContent = config.metaBody;
    byId('demoUseCaseTitle').textContent = config.useCaseTitle;
    byId('demoUseCaseBody').textContent = config.useCaseBody;
    byId('demoEmbedNote').textContent = config.note;

    byId('demoCaseStudy').href = config.caseStudyUrl;

    byId('demoShellBadges').innerHTML = config.badges.map((badge, index) => `
        <span class="demo-shell-pill${index === 0 ? ' emphasis' : ''}">${escapeHtml(badge)}</span>
    `).join('');
}

async function mountDemo(config) {
    const frame = byId('demoEmbedFrame');
    const frameShell = frame.closest('.demo-embed-frame-shell');
    const openLink = byId('demoOpenLink');
    const status = byId('demoEmbedStatus');
    const toolbarLabel = byId('demoToolbarLabel');
    const resolved = await resolveDemoSource(config);

    frameShell.querySelector('.demo-embed-empty')?.remove();
    frame.hidden = false;
    frame.src = resolved.url;

    openLink.href = resolved.url;
    openLink.textContent = 'Open Fullscreen';
    openLink.setAttribute('target', '_blank');
    openLink.setAttribute('rel', 'noopener noreferrer');

    byId('demoCaseStudy').href = config.caseStudyUrl;
    byId('demoCaseStudy').textContent = 'View Case Study';

    status.classList.remove('live', 'fallback', 'offline');

    if (resolved.mode === 'live') {
        toolbarLabel.textContent = 'Embedded live app';
        status.textContent = 'Live app embedded';
        status.classList.add('live');
        return;
    }

    toolbarLabel.textContent = 'Embedded fallback showcase';
    status.textContent = 'Using showcase fallback';
    status.classList.add('fallback');
}

function renderUnavailableDemo(config) {
    document.title = `${config.label} | Live Demo | Architech Designs`;

    byId('demoEyebrow').textContent = config.label;
    byId('demoTitle').textContent = config.title;
    byId('demoSubtitle').textContent = config.subtitle;
    byId('demoToolbarLabel').textContent = 'Demo unavailable';
    byId('demoToolbarTitle').textContent = 'This concept is currently offline';
    byId('demoMetaHeadline').textContent = config.metaHeadline;
    byId('demoMetaBody').textContent = config.metaBody;
    byId('demoUseCaseTitle').textContent = config.useCaseTitle;
    byId('demoUseCaseBody').textContent = config.useCaseBody;
    byId('demoEmbedNote').textContent = config.note;

    byId('demoShellBadges').innerHTML = ['Unavailable', 'Removed From Public Site', 'Rebuild In Progress'].map((badge, index) => `
        <span class="demo-shell-pill${index === 0 ? ' emphasis' : ''}">${escapeHtml(badge)}</span>
    `).join('');

    const openLink = byId('demoOpenLink');
    openLink.href = 'portfolio.html';
    openLink.textContent = 'Browse Projects';
    openLink.removeAttribute('target');
    openLink.removeAttribute('rel');

    const caseStudyLink = byId('demoCaseStudy');
    caseStudyLink.href = 'live-demo.html?demo=medspa-beauty';
    caseStudyLink.textContent = 'Open Med Spa Demo';

    const frame = byId('demoEmbedFrame');
    const frameShell = frame.closest('.demo-embed-frame-shell');
    frame.hidden = true;
    frame.removeAttribute('src');

    let emptyState = frameShell.querySelector('.demo-embed-empty');
    if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'demo-embed-empty';
        frameShell.appendChild(emptyState);
    }

    emptyState.innerHTML = `
        <div class="demo-embed-empty-card">
            <strong>Temporarily removed from the public website</strong>
            <p>This law firm concept is staying blank for now while the experience is reworked. The live med spa demo remains available.</p>
            <div class="demo-shell-actions">
                <a href="portfolio.html" class="btn btn-secondary btn-lg">Back to Projects</a>
                <a href="live-demo.html?demo=medspa-beauty" class="btn btn-primary btn-lg">Open Med Spa Demo</a>
            </div>
        </div>
    `;

    const status = byId('demoEmbedStatus');
    status.textContent = 'Currently hidden';
    status.classList.remove('live', 'fallback');
    status.classList.add('offline');
}

async function resolveDemoSource(config) {
    for (const candidate of config.candidates) {
        if (await isEmbeddablePage(candidate)) {
            return { mode: 'live', url: candidate };
        }
    }

    return { mode: 'fallback', url: config.fallbackUrl };
}

async function isEmbeddablePage(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            return false;
        }

        const text = await response.text();
        if (/Directory listing for/i.test(text) || /<title>Index of/i.test(text) || /Error response/i.test(text)) {
            return false;
        }

        return /<html/i.test(text);
    } catch (error) {
        return false;
    }
}

function byId(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
