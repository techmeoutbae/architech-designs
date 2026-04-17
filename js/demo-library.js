export const DEMO_MAP = {
    'beauty-service': {
        key: 'beauty-service',
        title: 'Beauty Service Demo',
        cardTitle: 'Luxury booking experience for beauty brands.',
        subtitle: 'A luxury beauty-service experience with booking, deposits, memberships, reviews, before-and-after content, and local SEO foundations presented inside a polished wrapper.',
        eyebrow: 'Vercel Demo | Beauty Services',
        detailEyebrow: 'Luxury Service Demo',
        toolbarTitle: 'Beauty service demo wrapper',
        liveUrl: 'https://beauty-service-six.vercel.app/',
        detailUrl: 'demo-details.html?demo=beauty-service',
        badges: ['Vercel Live', 'Booking Experience', 'Premium Service UX'],
        note: 'This demo shows how a premium service business can combine authority, trust, online booking, recurring revenue offers, and stronger conversion pathways without feeling cluttered.',
        metaHeadline: 'High-conversion service design for premium beauty brands',
        metaBody: 'Booking, deposits, reviews, before-and-after content, team presentation, memberships, and local SEO structure work together to support higher-ticket positioning.',
        useCaseTitle: 'Why it matters',
        useCaseBody: 'Ideal for med spas, salons, estheticians, and other beauty brands that need both premium presentation and a practical booking flow.',
        heroDescription: 'Designed for booking-driven beauty brands that need authority, trust, and a smoother path from browsing to paid consultation.',
        metrics: [
            { value: '6+', label: 'Trust layers built into the journey' },
            { value: '2', label: 'Revenue paths across services and memberships' },
            { value: '1', label: 'Cleaner booking flow from first click to deposit' }
        ],
        specs: [
            { label: 'Business Model', value: 'Luxury service / booking-led' },
            { label: 'Primary Goal', value: 'Turn interest into booked consultations and deposits' },
            { label: 'UX Focus', value: 'Trust, treatment clarity, and friction-light booking' },
            { label: 'Technical Shape', value: 'Multi-page marketing site with booking and conversion paths' }
        ],
        featureGroups: [
            {
                title: 'Core Features',
                items: [
                    'Booking and deposit flow',
                    'Team, reviews, and FAQ trust architecture',
                    'Before-and-after presentation',
                    'Membership and package merchandising',
                    'Lead capture and consultation pathways',
                    'SEO-ready service structure and schema'
                ]
            },
            {
                title: 'Benefits',
                items: [
                    'Makes premium services feel more credible and bookable',
                    'Supports recurring revenue through packages and memberships',
                    'Builds trust faster with visible policies, reviews, and team detail',
                    'Turns browsing into action with a clearer booking path'
                ]
            },
            {
                title: 'What The Build Signals',
                items: [
                    'A luxury visual system without template clutter',
                    'Operational thinking behind the presentation layer',
                    'A practical conversion path for higher-ticket services',
                    'Room to expand into portals, automation, or CRM workflows'
                ]
            }
        ],
        architecture: [
            'Premium homepage and treatment presentation',
            'Consultation and booking flow with deposits',
            'Social proof, policy clarity, and recurring offers',
            'SEO structure ready for local discovery'
        ]
    },
    'product-brand': {
        key: 'product-brand',
        title: 'Product Brand Demo',
        cardTitle: 'Luxury storytelling with checkout-ready structure.',
        subtitle: 'A premium product-brand experience with curated storytelling, product depth, trust pages, a working cart flow, and Stripe-ready checkout structure.',
        eyebrow: 'Vercel Demo | Product Brand',
        detailEyebrow: 'Luxury Product Demo',
        toolbarTitle: 'Product brand demo wrapper',
        liveUrl: 'https://product-site-lac-nu.vercel.app/',
        detailUrl: 'demo-details.html?demo=product-brand',
        badges: ['Vercel Live', 'Luxury Ecommerce', 'Checkout Ready'],
        note: 'This demo shows how a restrained visual system, product storytelling, trust layers, and checkout-ready UX can make a smaller brand feel commercially credible.',
        metaHeadline: 'Luxury product presentation without template noise',
        metaBody: 'Multi-page structure, product discovery, cart behavior, brand story, legal depth, and Stripe-powered checkout support a more premium buying journey.',
        useCaseTitle: 'Why it matters',
        useCaseBody: 'Ideal for brands selling products online that need credibility, stronger art direction, and a more elevated commerce experience.',
        heroDescription: 'Built for product brands that need elevated art direction, better product framing, and a buying journey that feels commercially ready.',
        metrics: [
            { value: '4', label: 'Commerce trust layers across the site' },
            { value: '3', label: 'Core revenue moments from browse to checkout' },
            { value: '1', label: 'Tighter narrative between brand and product' }
        ],
        specs: [
            { label: 'Business Model', value: 'Luxury ecommerce / direct-to-consumer' },
            { label: 'Primary Goal', value: 'Improve perceived value and checkout confidence' },
            { label: 'UX Focus', value: 'Editorial storytelling with cleaner product discovery' },
            { label: 'Technical Shape', value: 'Multi-page storefront with cart and Stripe-ready checkout' }
        ],
        featureGroups: [
            {
                title: 'Core Features',
                items: [
                    'Multi-page brand and collection structure',
                    'Editorial product presentation',
                    'Cart drawer and Stripe-ready checkout flow',
                    'Shipping, terms, privacy, and FAQ trust pages',
                    'Brand story and product-detail depth',
                    'Premium product discovery and selection UX'
                ]
            },
            {
                title: 'Benefits',
                items: [
                    'Makes smaller brands look more commercially established',
                    'Reduces friction from browse to cart to checkout',
                    'Supports higher perceived value through controlled art direction',
                    'Feels complete and trustworthy instead of template-driven'
                ]
            },
            {
                title: 'What The Build Signals',
                items: [
                    'A brand system with stronger product merchandising',
                    'Checkout intent without sacrificing visual restraint',
                    'A more premium feel across legal, support, and cart states',
                    'A cleaner path into subscriptions, bundles, or retention flows'
                ]
            }
        ],
        architecture: [
            'Brand-led landing and collection discovery',
            'Editorial product details and cart behavior',
            'Checkout-ready structure with trust pages',
            'Room for merchandising, bundles, and lifecycle expansion'
        ]
    }
};

export const DEFAULT_DEMO_KEY = 'beauty-service';

export function hasDemo(key) {
    return Boolean(DEMO_MAP[key]);
}

export function getDemoConfig(key) {
    return DEMO_MAP[key] || DEMO_MAP[DEFAULT_DEMO_KEY];
}
