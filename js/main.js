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
                document.body.style.overflow = navLinks?.classList.contains('active') ? 'hidden' : '';
            });
            
            // Close menu when clicking a link
            navLinks?.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('active');
                    mobileToggle.classList.remove('active');
                    document.body.style.overflow = '';
                });
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', function(e) {
                if (navLinks?.classList.contains('active') && 
                    !navLinks.contains(e.target) && 
                    !mobileToggle.contains(e.target)) {
                    navLinks.classList.remove('active');
                    mobileToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
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

    // ========== CARD MODAL FOR MOBILE ==========
    try {
        const cardModal = document.getElementById('cardModal');
        const cardModalOverlay = document.getElementById('cardModalOverlay');
        const cardModalClose = document.getElementById('cardModalClose');
        const cardModalTitle = document.getElementById('cardModalTitle');
        const cardModalText = document.getElementById('cardModalText');
        const cardModalIcon = document.getElementById('cardModalIcon');
        
        if (!cardModal) {
            Logger.warn('CardModal', 'Card modal not found');
        } else {
            // Get all clickable cards
            const clickableCards = document.querySelectorAll('.service-card, .package-card, .who-card, .approach-card');
            
            clickableCards.forEach(card => {
                card.addEventListener('click', function(e) {
                    // Don't trigger if clicking a link inside the card
                    if (e.target.tagName === 'A' || e.target.closest('a')) return;
                    
                    const title = this.querySelector('h3')?.textContent || '';
                    const text = this.querySelector('p')?.textContent || '';
                    const icon = this.querySelector('.service-icon, .who-icon')?.innerHTML || '';
                    
                    cardModalTitle.textContent = title;
                    cardModalText.textContent = text;
                    cardModalIcon.innerHTML = icon;
                    
                    cardModal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                });
            });
            
            // Close modal functions
            function closeCardModal() {
                cardModal.classList.remove('active');
                document.body.style.overflow = '';
            }
            
            cardModalOverlay.addEventListener('click', closeCardModal);
            cardModalClose.addEventListener('click', closeCardModal);
            
            // Close on escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && cardModal.classList.contains('active')) {
                    closeCardModal();
                }
            });
            
            Logger.info('CardModal', 'Initialized card modal');
        }
    } catch (e) {
        Logger.error('CardModal', 'Failed to initialize card modal', e);
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

    const cardModal = document.getElementById('cardModal');
    const cardModalOverlay = document.getElementById('cardModalOverlay');
    const cardModalClose = document.getElementById('cardModalClose');
    const cardModalIcon = document.getElementById('cardModalIcon');
    const cardModalTitle = document.getElementById('cardModalTitle');
    const cardModalText = document.getElementById('cardModalText');

    if (cardModal && cardModalOverlay && cardModalClose) {
        function openCardModal(iconHtml, title, text) {
            if (cardModalIcon && cardModalTitle && cardModalText) {
                cardModalIcon.innerHTML = iconHtml;
                cardModalTitle.textContent = title;
                cardModalText.textContent = text;
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

        const clickableCards = document.querySelectorAll('.service-card, .package-card, .value-card');
        clickableCards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    const icon = this.querySelector('.service-icon, .value-icon');
                    const title = this.querySelector('h3, h4');
                    const text = this.querySelector('p');
                    
                    if (title && text) {
                        const iconHtml = icon ? icon.innerHTML : '';
                        openCardModal(iconHtml, title.textContent, text.textContent);
                    }
                }
            });

            card.addEventListener('keydown', function(e) {
                if ((e.key === 'Enter' || e.key === ' ') && window.innerWidth <= 768) {
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
            
            let currentStep = 0;
            const totalSteps = questions.length - 1;
            const answers = {};
            
            totalQuestionsEl.textContent = totalSteps;
            
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
                if (needs.includes('content')) {
                    growthScore += 2;
                    premiumScore += 1;
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
                    description = 'Complete solution for serious growth. Advanced features, ongoing support, and comprehensive strategy.';
                    features = [
                        'Unlimited pages & features',
                        'Advanced SEO & content strategy',
                        'Conversion optimization',
                        'E-commerce capabilities',
                        'Custom animations & interactions',
                        'Ongoing support & maintenance',
                        'Monthly strategy calls',
                        'Priority turnaround'
                    ];
                } else if (growthScore === maxScore) {
                    recommendedPackage = 'growth';
                    description = 'Perfect for growing businesses that need a professional website to generate leads and build credibility.';
                    features = [
                        'Up to 8 custom pages',
                        'Premium design with animations',
                        'Advanced SEO optimization',
                        'Lead capture & automation',
                        'Speed optimization',
                        '3 weeks delivery',
                        'Post-launch support'
                    ];
                } else {
                    recommendedPackage = 'launch';
                    description = 'Great starting point! Get your business online quickly with a professional website that attracts customers.';
                    features = [
                        'Up to 5 professional pages',
                        'Mobile-responsive design',
                        'Contact forms & calls to action',
                        'Basic SEO setup',
                        'Google Maps integration',
                        '2 weeks delivery'
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
                    'launch': { name: 'Launch Site', subtitle: 'Starting Package' },
                    'growth': { name: 'Growth Site', subtitle: 'Most Popular' },
                    'premium': { name: 'Premium Growth System', subtitle: 'Best Value' }
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
                const isMultiSelect = key === 'primary_goal' || key === 'help_needed';
                
                options.forEach(option => {
                    option.addEventListener('click', function() {
                        if (isMultiSelect) {
                            // Toggle selection for multi-select questions
                            this.classList.toggle('selected');
                            
                            // Collect all selected values
                            const selectedValues = [];
                            options.forEach(o => {
                                if (o.classList.contains('selected')) {
                                    selectedValues.push(o.dataset.value);
                                }
                            });
                            answers[key] = selectedValues;
                            
                            // Auto-advance after a short delay if at least one is selected
                            if (selectedValues.length > 0) {
                                setTimeout(() => {
                                    if (qIndex < totalSteps - 1) {
                                        currentStep = qIndex + 1;
                                        showQuestion(currentStep);
                                    } else {
                                        showResults();
                                    }
                                }, 400);
                            }
                        } else {
                            // Single select behavior
                            options.forEach(o => o.classList.remove('selected'));
                            this.classList.add('selected');
                            answers[key] = this.dataset.value;
                            
                            setTimeout(() => {
                                if (qIndex < totalSteps - 1) {
                                    currentStep = qIndex + 1;
                                    showQuestion(currentStep);
                                } else {
                                    showResults();
                                }
                            }, 300);
                        }
                    });
                });
            });
            
            quizRetake.addEventListener('click', function() {
                currentStep = 0;
                Object.keys(answers).forEach(key => delete answers[key]);
                quizWrapper.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                quizWrapper.querySelectorAll('.quiz-progress-step').forEach(s => s.classList.remove('active', 'completed'));
                showQuestion(0);
            });
            
            showQuestion(0);
            Logger.info('Quiz', 'Website quiz initialized');
        }
    } catch (e) {
        Logger.error('Quiz', 'Failed to initialize website quiz', e);
    }
});
