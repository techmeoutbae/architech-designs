import { DEFAULT_DEMO_KEY, getDemoConfig, hasDemo } from './demo-library.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const demoKey = params.get('demo') || DEFAULT_DEMO_KEY;

    if (!hasDemo(demoKey)) {
        window.location.replace(`demo-details.html?demo=${encodeURIComponent(DEFAULT_DEMO_KEY)}`);
        return;
    }

    const config = getDemoConfig(demoKey);
    renderDemoDetail(config);
});

function renderDemoDetail(config) {
    document.title = `${config.title} | Demo Details | Architech Designs`;

    byId('demoDetailEyebrow').textContent = config.detailEyebrow;
    byId('demoDetailTitle').textContent = config.title;
    byId('demoDetailSubtitle').textContent = config.subtitle;
    byId('demoDetailHeadline').textContent = config.metaHeadline;
    byId('demoDetailDescription').textContent = config.heroDescription;
    byId('demoDetailEmbeddedLink').href = `live-demo.html?demo=${encodeURIComponent(config.key)}`;
    byId('demoDetailLiveLink').href = config.liveUrl;

    byId('demoDetailBadges').innerHTML = config.badges.map((badge, index) => `
        <span class="demo-shell-pill${index === 0 ? ' emphasis' : ''}">${escapeHtml(badge)}</span>
    `).join('');

    byId('demoDetailMetrics').innerHTML = config.metrics.map((metric) => `
        <article class="demo-detail-metric-card">
            <strong>${escapeHtml(metric.value)}</strong>
            <span>${escapeHtml(metric.label)}</span>
        </article>
    `).join('');

    byId('demoDetailSpecs').innerHTML = config.specs.map((spec) => `
        <article class="demo-detail-spec-card">
            <span>${escapeHtml(spec.label)}</span>
            <strong>${escapeHtml(spec.value)}</strong>
        </article>
    `).join('');

    byId('demoDetailFeatureGrid').innerHTML = config.featureGroups.map((group) => `
        <article class="demo-detail-feature-card">
            <span class="demo-detail-kicker">${escapeHtml(group.title)}</span>
            <ul class="demo-detail-check-list">
                ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        </article>
    `).join('');

    byId('demoDetailArchitecture').innerHTML = config.architecture.map((item, index) => `
        <article class="demo-detail-architecture-card">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <strong>${escapeHtml(item)}</strong>
        </article>
    `).join('');
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
