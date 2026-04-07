// Bubble Animation
function createBubbles() {
    const container = document.getElementById('bubbles');
    const bubbleCount = 25;
    const colors = [
        'rgba(212, 165, 165, 0.4)',
        'rgba(184, 134, 11, 0.25)',
        'rgba(232, 196, 196, 0.5)',
        'rgba(212, 165, 165, 0.2)',
        'rgba(184, 134, 11, 0.15)'
    ];

    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        const size = Math.random() * 70 + 10;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const duration = Math.random() * 20 + 15;
        const delay = Math.random() * 10;
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${left}%`;
        bubble.style.background = color;
        bubble.style.animationDuration = `${duration}s`;
        bubble.style.animationDelay = `${delay}s`;
        
        container.appendChild(bubble);
    }
}

// Navigation Scroll Effect
function handleNavScroll() {
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Update active nav link based on scroll position
        const sections = document.querySelectorAll('.page-section, section[id]');
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 150;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Mobile Navigation Toggle
function setupMobileNav() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
    
    // Close nav when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
}

// Scroll Animations
function setupScrollAnimations() {
    const elements = document.querySelectorAll('.service-card, .ba-comparison, .faq-item, .review-card, .credential');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach(el => {
        el.classList.add('scroll-animate');
        observer.observe(el);
    });
}

// Before & After Slider
function setupBeforeAfterSlider() {
    const sliders = document.querySelectorAll('.ba-slider');
    
    sliders.forEach(slider => {
        const handle = slider.querySelector('.ba-handle');
        const before = slider.querySelector('.ba-before');
        let isDragging = false;
        
        const updateSlider = (x) => {
            const rect = slider.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
            before.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
            handle.style.left = `${percentage}%`;
        };
        
        handle.addEventListener('mousedown', () => isDragging = true);
        handle.addEventListener('touchstart', () => isDragging = true);
        
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('touchend', () => isDragging = false);
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) updateSlider(e.clientX);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging) updateSlider(e.touches[0].clientX);
        });
        
        // Click to jump
        slider.addEventListener('click', (e) => {
            if (!e.target.closest('.ba-handle')) {
                updateSlider(e.clientX);
            }
        });
    });
}

// Reviews Carousel
function setupReviewsCarousel() {
    const track = document.querySelector('.reviews-track');
    const dotsContainer = document.getElementById('reviewsDots');
    const reviewCards = document.querySelectorAll('.review-card');
    let currentIndex = 0;
    let autoPlayInterval;
    
    const totalSlides = Math.ceil(reviewCards.length / 2);
    
    // Create dots
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('div');
        dot.className = `review-dot ${i === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }
    
    function goToSlide(index) {
        currentIndex = index;
        const offset = index * (100 / totalSlides);
        track.style.transform = `translateX(-${offset}%)`;
        
        document.querySelectorAll('.review-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    
    function nextSlide() {
        currentIndex = (currentIndex + 1) % totalSlides;
        goToSlide(currentIndex);
    }
    
    // Auto-play
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 5000);
    }
    
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }
    
    // Pause on hover
    const carousel = document.getElementById('reviewsCarousel');
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);
    
    startAutoPlay();
}

// FAQ Accordion
function setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// Multi-step Form
function setupBookingForm() {
    const form = document.getElementById('bookingForm');
    const steps = document.querySelectorAll('.form-step');
    const progressSteps = document.querySelectorAll('.progress-step');
    let currentStep = 1;
    
    function updateProgress() {
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 <= currentStep);
        });
    }
    
    function showStep(step) {
        steps.forEach(s => s.classList.remove('active'));
        document.querySelector(`.form-step[data-step="${step}"]`).classList.add('active');
        currentStep = step;
        updateProgress();
    }
    
    // Next button handlers
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentFormStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
            const inputs = currentFormStep.querySelectorAll('input[required], select[required]');
            
            let isValid = true;
            inputs.forEach(input => {
                if (!input.value) {
                    isValid = false;
                    input.style.borderColor = '#e74c3c';
                } else {
                    input.style.borderColor = '';
                }
            });
            
            if (isValid && currentStep < 3) {
                showStep(currentStep + 1);
            }
        });
    });
    
    // Previous button handlers
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });
    });
    
    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show success message
        const formStep = document.querySelector(`.form-step[data-step="3"]`);
        formStep.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">✨</div>
                <h3 style="font-size: 1.8rem; margin-bottom: 15px;">Booking Received!</h3>
                <p style="color: #666; margin-bottom: 25px;">Thank you for choosing Lumina Beauty. We'll contact you shortly to confirm your appointment.</p>
                <button type="button" class="btn btn-primary" onclick="location.reload()">Book Another</button>
            </div>
        `;
    });
    
    // Date input - set min date to today
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
}

// Full Booking Form (Book Page)
function setupFullBookingForm() {
    const form = document.getElementById('bookingFormFull');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(form);
            const firstname = formData.get('firstname');
            
            // Replace form with success message
            form.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">✨</div>
                    <h3 style="font-size: 1.8rem; margin-bottom: 15px;">Booking Received!</h3>
                    <p style="color: #666; margin-bottom: 25px;">Thank you${firstname ? ' ' + firstname : ''} for choosing Lumina Beauty. We'll contact you shortly to confirm your appointment.</p>
                    <button type="button" class="btn btn-primary" onclick="location.reload()">Submit Another</button>
                </div>
            `;
        });
        
        // Set min date
        const dateInput = form.querySelector('input[type="date"]');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', today);
        }
    }
}

// Smooth Scroll for Navigation
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 100;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Before & After Filter
function setupBAFilter() {
    const filterBtns = document.querySelectorAll('.ba-filter-btn');
    const baCards = document.querySelectorAll('.ba-card');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            baCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                if (filter === 'all' || category === filter) {
                    card.style.display = 'block';
                    card.style.animation = 'fadeInUp 0.5s ease';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// Reviews Filter
function setupReviewsFilter() {
    const filterBtns = document.querySelectorAll('.review-filter-btn');
    const reviewCards = document.querySelectorAll('.review-card-full');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            reviewCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                if (filter === 'all' || category === filter) {
                    card.style.display = 'block';
                    card.style.animation = 'fadeInUp 0.5s ease';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// Parallax Effect for Hero
function setupParallax() {
    const hero = document.querySelector('.hero');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
            hero.style.backgroundPositionY = `${scrolled * 0.3}px`;
        }
    });
}

// Hero Slider
function setupHeroSlider() {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;
    
    const dots = document.querySelectorAll('.hero-dot');
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    const totalSlides = slides.length;
    
    function goToSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;
    }
    
    function nextSlide() {
        const next = (currentSlide + 1) % totalSlides;
        goToSlide(next);
    }
    
    // Auto-advance every 5 seconds
    setInterval(nextSlide, 5000);
    
    // Dot navigation
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const slideIndex = parseInt(dot.getAttribute('data-slide'));
            goToSlide(slideIndex);
        });
    });
}

// Initialize all functions
document.addEventListener('DOMContentLoaded', () => {
    createBubbles();
    handleNavScroll();
    setupMobileNav();
    setupScrollAnimations();
    setupBeforeAfterSlider();
    setupBAFilter();
    setupReviewsFilter();
    setupReviewsCarousel();
    setupFAQ();
    setupBookingForm();
    setupFullBookingForm();
    setupSmoothScroll();
    setupParallax();
    setupHeroSlider();
});
