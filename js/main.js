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

document.addEventListener('DOMContentLoaded', function() {
    Logger.info('App', 'Application initializing...');

    // ========== NAVIGATION COMPONENT ==========
    try {
        const navbar = document.querySelector('.navbar');
        const mobileToggle = document.querySelector('.mobile-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (!navbar) {
            Logger.error('Navigation', 'Navbar element not found');
        }
        
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar?.classList.add('scrolled');
            } else {
                navbar?.classList.remove('scrolled');
            }
        });
        
        if (mobileToggle) {
            mobileToggle.addEventListener('click', function() {
                navLinks?.classList.toggle('active');
                mobileToggle.classList.toggle('active');
            });
            Logger.info('Navigation', 'Mobile toggle initialized');
        }
    } catch (e) {
        Logger.error('Navigation', 'Failed to initialize navigation', e);
    }

    // ========== SMOOTH SCROLL COMPONENT ==========
    try {
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        checkReveal();
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
                    if (statTop < windowHeight - 100) updateCounter();
                }
            });
        }
        
        window.addEventListener('scroll', animateCounters);
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
        const contactForm = document.querySelector('.contact-form form');
        
        if (contactForm) {
            contactForm.addEventListener('submit', async function(e) {
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.textContent : 'Submit';
                
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
                
                if (isValid && submitBtn) {
                    submitBtn.textContent = 'Sending...';
                    submitBtn.disabled = true;
                    
                    try {
                        const response = await fetch(contactForm.action, {
                            method: 'POST',
                            body: new FormData(contactForm),
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            submitBtn.textContent = 'Message Sent!';
                            submitBtn.style.background = 'var(--success)';
                            submitBtn.style.color = 'var(--white)';
                            contactForm.reset();
                            Logger.info('ContactForm', 'Form submitted successfully to Formspree');
                        } else {
                            submitBtn.textContent = 'Error - Try Again';
                            Logger.error('ContactForm', 'Formspree submission failed');
                        }
                    } catch (error) {
                        submitBtn.textContent = 'Error - Try Again';
                        Logger.error('ContactForm', 'Form submission error: ' + error.message);
                    }
                    
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.background = '';
                        submitBtn.style.color = '';
                        submitBtn.disabled = false;
                    }, 5000);
                } else {
                    Logger.warn('ContactForm', 'Form validation failed');
                }
            });
            Logger.info('ContactForm', 'Contact form initialized');
        }
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

    // ========== STICKY NAVIGATION COMPONENT ==========
    try {
        let lastScroll = 0;
        const nav = document.querySelector('.navbar');
        
        window.addEventListener('scroll', function() {
            if (!nav) return;
            
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 500) {
                if (currentScroll > lastScroll) {
                    nav.style.transform = 'translateY(-100%)';
                } else {
                    nav.style.transform = 'translateY(0)';
                }
            } else {
                nav.style.transform = 'translateY(0)';
            }
            
            lastScroll = currentScroll;
        });
        Logger.info('StickyNav', 'Sticky navigation initialized');
    } catch (e) {
        Logger.error('StickyNav', 'Failed to initialize sticky navigation', e);
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
});
