# MedSpa Beauty Website Template - Specification

## Project Overview
- **Project Name**: Lumina Beauty - Luxury MedSpa Template
- **Type**: Multi-page website template
- **Core Functionality**: Elegant, interactive website for medspas, estheticians, salons, lash techs, and injectors
- **Target Users**: Women seeking premium beauty and wellness services

---

## Pages Structure

### 1. Home Page
- Navigation with logo and page links
- Hero section with luxury aesthetic, floating bubbles animation
- Premium offer positioning section
- Results gallery preview (Before/After)
- Trust and credentials section
- FAQ accordion
- Consultation lead form
- Footer with contact info

### 2. Treatments / Services Page
- Services grid with hover effects
- Category filtering (Facials, Injections, Lashes, Massage, etc.)
- Service cards with pricing, duration, descriptions

### 3. Before & After Page
- Interactive image comparison sliders
- Gallery with lightbox
- Category tabs

### 4. About Page
- Team/ practitioner profile
- Story and credentials
- Facility tour (image gallery)

### 5. Reviews Page
- Testimonial carousel
- Star ratings
- Review cards with photos

### 6. Book Now / Contact Page
- Booking form
- Contact information
- Map integration placeholder
- FAQ link

---

## UI/UX Specification

### Color Palette
- **Primary**: #D4A5A5 (Dusty Rose)
- **Secondary**: #F5E6E8 (Soft Blush)
- **Accent**: #B8860B (Gold)
- **Dark**: #2D2D2D (Charcoal)
- **Light**: #FDF8F8 (Cream White)
- **Highlight**: #E8C4C4 (Rosy Pink)
- **Bubble Colors**: rgba(212, 165, 165, 0.3), rgba(184, 134, 11, 0.2), rgba(232, 196, 196, 0.4)

### Typography
- **Headings**: 'Playfair Display', serif (elegant, luxurious)
- **Body**: 'Raleway', sans-serif (clean, modern)
- **Accent**: 'Cormorant Garamond', serif (for quotes/highlights)
- **Sizes**:
  - H1: 4rem (hero)
  - H2: 2.8rem (section titles)
  - H3: 1.8rem (card titles)
  - Body: 1rem
  - Small: 0.875rem

### Spacing System
- Section padding: 100px vertical
- Container max-width: 1400px
- Card padding: 40px
- Gap between elements: 30px

### Visual Effects
- **Bubbles**: Floating animation, varying sizes (10px-80px), random movement
- **Gold shimmer**: Subtle gradient animations on accents
- **Glass morphism**: Frosted glass effect on cards
- **Hover effects**: Scale, shadow, color transitions
- **Page transitions**: Fade in on scroll

### Responsive Breakpoints
- Desktop: 1200px+
- Tablet: 768px - 1199px
- Mobile: < 768px

---

## Components

### Navigation
- Fixed header with glass effect
- Logo on left, nav links center, "Book Now" button right
- Mobile hamburger menu
- Active page indicator

### Hero Section
- Full viewport height
- Background with gradient and subtle bubble animation
- Elegant headline with gold accent
- Subheadline and dual CTA buttons
- Scroll indicator

### Premium Offer Card
- Glass morphism effect
- Floating decorative elements
- Special pricing/offer display

### Service Cards
- Image with overlay
- Title, description, price, duration
- Hover: scale up, shadow increase, "Book" button reveal

### Before/After Slider
- Draggable divider
- Image comparison
- Labels showing "Before" / "After"

### Testimonial Carousel
- Auto-rotating
- Star rating display
- Client photo, name, service
- Quote marks decoration

### FAQ Accordion
- Plus/minus icon animation
- Smooth expand/collapse
- Category grouping

### Consultation Form
- Multi-step form with progress
- Name, email, phone, service interest, message
- Calendar picker for preferred date
- Validation with visual feedback

### Footer
- Multi-column layout
- Social media icons
- Newsletter signup
- Contact information

---

## Functionality Specification

### Core Features
1. Smooth scrolling navigation
2. Mobile responsive menu
3. Interactive bubble animations (CSS-only)
4. Before/After image comparison slider
5. Testimonial auto-carousel
6. FAQ accordion
7. Form validation
8. Scroll-triggered animations
9. Lightbox for gallery
10. Service filtering

### User Interactions
- Nav links scroll to sections (single page feel for Home)
- Service cards reveal "Book" button on hover
- FAQ items expand/collapse on click
- Form validates on submit
- Gallery images open in lightbox
- Testimonials auto-advance with pause on hover

### Animations
- Bubbles: Continuous floating, varying speeds
- Scroll: Fade-in-up for elements
- Hover: Scale 1.02-1.05, shadow enhancement
- Carousel: Smooth slide transition
- Accordion: Height transition

---

## Acceptance Criteria

1. All 6 pages/sections are present and accessible
2. Color scheme is cohesive and luxurious (rose/gold/cream)
3. Bubble animations run smoothly on Home page
4. Navigation is functional and highlights active page
5. All forms have proper validation
6. Before/After slider is interactive
7. Testimonial carousel works
8. FAQ accordion expands/collapses
9. Site is responsive on mobile/tablet
10. No console errors
11. All fonts load correctly
12. Interactive elements have hover/focus states

---

## File Structure
- `index.html` - Main HTML file with all page sections
- `styles.css` - All styling
- `script.js` - All interactivity
