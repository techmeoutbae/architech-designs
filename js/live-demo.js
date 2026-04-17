const DEMO_MAP = {
    'beauty-service': {
        title: 'Beauty Service Demo',
        subtitle: 'A luxury beauty-service experience with booking, deposits, memberships, reviews, before-and-after content, and local SEO foundations presented inside a polished wrapper.',
        eyebrow: 'Vercel Demo · Beauty Services',
        toolbarTitle: 'Beauty service demo wrapper',
        liveUrl: 'https://beauty-service-six.vercel.app/',
        caseStudyUrl: 'demo-details.html?demo=beauty-service',
        badges: ['Vercel Live', 'Booking Experience', 'Premium Service UX'],
        note: 'This demo shows how a premium service business can combine authority, trust, online booking, recurring revenue offers, and stronger conversion pathways without feeling cluttered.',
        metaHeadline: 'High-conversion service design for premium beauty brands',
        metaBody: 'Booking, deposits, reviews, before-and-after content, team presentation, memberships, and local SEO structure work together to support higher-ticket positioning.',
        useCaseTitle: 'Why it matters',
        useCaseBody: 'Ideal for med spas, salons, estheticians, and other beauty brands that need both premium presentation and a practical booking flow.'
    },
    'product-brand': {
        title: 'Product Brand Demo',
        subtitle: 'A premium product-brand experience with curated storytelling, product depth, trust pages, a working cart flow, and Stripe-ready checkout structure.',
        eyebrow: 'Vercel Demo · Product Brand',
        toolbarTitle: 'Product brand demo wrapper',
        liveUrl: 'https://product-site-lac-nu.vercel.app/',
        caseStudyUrl: 'demo-details.html?demo=product-brand',
        badges: ['Vercel Live', 'Luxury Ecommerce', 'Checkout Ready'],
        note: 'This demo shows how a restrained visual system, product storytelling, trust layers, and checkout-ready UX can make a smaller brand feel commercially credible.',
        metaHeadline: 'Luxury product presentation without template noise',
        metaBody: 'Multi-page structure, product discovery, cart behavior, brand story, legal depth, and Stripe-powered checkout support a more premium buying journey.',
        useCaseTitle: 'Why it matters',
        useCaseBody: 'Ideal for brands selling products online that need credibility, stronger art direction, and a more elevated commerce experience.'
    }
};

const DEFAULT_DEMO_KEY = 'beauty-service';

document.addEventListener('DOMContentLoaded', async () => {
    const demoKey = new URLSearchParams(window.location.search).get('demo') || DEFAULT_DEMO_KEY;
    const config = DEMO_MAP[demoKey];

    if (!config) {
        window.location.replace(`live-demo.html?demo=${encodeURIComponent(DEFAULT_DEMO_KEY)}`);
        return;
    }

    applyDemoCopy(config);
    await mountDemo(config);
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
    byId('demoRoutingBody').textContent = 'This wrapper keeps the live Vercel deployment inside a premium presentation layer while still offering a clean path to the full site.';
    byId('demoCaseStudy').href = config.caseStudyUrl;
    byId('demoCaseStudy').textContent = 'View Demo Brief';

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

    frameShell.querySelector('.demo-embed-empty')?.remove();
    frame.hidden = false;
    frame.src = config.liveUrl;

    openLink.href = config.liveUrl;
    openLink.textContent = 'Open Live Site';
    openLink.setAttribute('target', '_blank');
    openLink.setAttribute('rel', 'noopener noreferrer');

    toolbarLabel.textContent = 'Embedded Vercel deployment';
    status.textContent = 'Live site embedded';
    status.classList.remove('fallback', 'offline');
    status.classList.add('live');

    frame.addEventListener('load', () => {
        status.textContent = 'Live site embedded';
    });
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
