const questions = [
    {
        question: "What are your primary skin concerns? (Select up to 2)",
        options: [
            { value: "aging", text: "Fine lines & wrinkles", img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop" },
            { value: "acne", text: "Acne & breakouts", img: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=100&h=100&fit=crop" },
            { value: "hydration", text: "Dryness & dehydration", img: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=100&h=100&fit=crop" },
            { value: "brightness", text: "Dullness & uneven tone", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=100&h=100&fit=crop" }
        ]
    },
    {
        question: "What is your skin type? (Select up to 2)",
        options: [
            { value: "oily", text: "Oily", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
            { value: "dry", text: "Dry", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" },
            { value: "combination", text: "Combination", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
            { value: "sensitive", text: "Sensitive", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop" }
        ]
    },
    {
        question: "What are your aesthetic goals? (Select up to 2)",
        options: [
            { value: "youthful", text: "Look more youthful", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop" },
            { value: "glow", text: "Get a radiant glow", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=100&h=100&fit=crop" },
            { value: "defined", text: "Enhance features", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
            { value: "maintain", text: "Maintain current look", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" }
        ]
    },
    {
        question: "How much downtime can you afford? (Select up to 2)",
        options: [
            { value: "none", text: "Zero downtime", img: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&h=100&fit=crop" },
            { value: "minimal", text: "A few hours", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop" },
            { value: "some", text: "1-2 days", img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop" },
            { value: "any", text: "No problem with recovery", img: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=100&h=100&fit=crop" }
        ]
    },
    {
        question: "What treatments interest you most? (Select up to 2)",
        options: [
            { value: "facial", text: "Facials & skincare", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=100&h=100&fit=crop" },
            { value: "injectables", text: "Injectables (Botox/Filler)", img: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=100&h=100&fit=crop" },
            { value: "lashes", text: "Lash & brow treatments", img: "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=100&h=100&fit=crop" },
            { value: "laser", text: "Laser treatments", img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop" }
        ]
    }
];

const treatmentDatabase = {
    facial: {
        treatments: [
            { name: "HydraFacial", description: "Deep cleansing, exfoliation, and hydration for instant glow. Perfect for all skin types.", price: "From $225", img: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=100&h=100&fit=crop", keywords: ["hydration", "brightness", "glow", "none", "minimal", "facial"] },
            { name: "Anti-Aging Facial", description: "Target fine lines with retinol and peptide technology for youthful, firmer skin.", price: "From $195", img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop", keywords: ["aging", "youthful", "some", "facial"] },
            { name: "Brightening Facial", description: "Vitamin C treatment for radiant, even-toned skin with lasting luminosity.", price: "From $175", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=100&h=100&fit=crop", keywords: ["brightness", "glow", "none", "minimal", "facial"] },
            { name: "Deep Cleansing Facial", description: "Thorough extraction and purification to clear pores and prevent breakouts.", price: "From $135", img: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=100&h=100&fit=crop", keywords: ["acne", "oily", "combination", "none", "minimal", "facial"] },
            { name: "Calming Sensitive Facial", description: "Gentle, soothing treatment designed for sensitive skin to reduce redness.", price: "From $160", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", keywords: ["sensitive", "dry", "none", "minimal", "facial"] }
        ]
    },
    injectables: {
        treatments: [
            { name: "Botox", description: "Smooth fine lines and wrinkles for a refreshed, youthful appearance.", price: "From $12/unit", img: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=100&h=100&fit=crop", keywords: ["aging", "youthful", "some", "any", "injectables"] },
            { name: "Dermal Fillers", description: "Restore volume and enhance natural features for a defined, youthful look.", price: "From $650", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop", keywords: ["aging", "defined", "some", "any", "injectables"] },
            { name: "Skin Boosters", description: "Deep hydration with hyaluronic acid micro-injections for glowing, plump skin.", price: "From $450", img: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=100&h=100&fit=crop", keywords: ["hydration", "dry", "glow", "some", "injectables"] },
            { name: "Lip Enhancement", description: "Natural-looking lip augmentation to enhance your smile and features.", price: "From $450", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", keywords: ["defined", "some", "injectables"] }
        ]
    },
    lashes: {
        treatments: [
            { name: "Volume Lash Extensions", description: "Full, dramatic lashes with 2-6 ultra-light lashes per natural lash.", price: "From $250", img: "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=100&h=100&fit=crop", keywords: ["defined", "glow", "none", "lashes"] },
            { name: "Classic Lash Extensions", description: "1:1 application for natural, elegant enhancement of your own lashes.", price: "From $175", img: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=100&h=100&fit=crop", keywords: ["maintain", "none", "lashes"] },
            { name: "Brow Lamination", description: "Semi-permanent styling for perfectly shaped, fluffy brows that last weeks.", price: "From $95", img: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=100&h=100&fit=crop", keywords: ["defined", "none", "lashes"] },
            { name: "Lash Lift & Tint", description: "Natural curl enhancement with tint for perfectly defined lashes.", price: "From $120", img: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&h=100&fit=crop", keywords: ["maintain", "defined", "none", "lashes"] }
        ]
    },
    laser: {
        treatments: [
            { name: "Laser Hair Removal", description: "Permanent hair reduction with advanced diode laser for smooth, hair-free skin.", price: "From $150", img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop", keywords: ["some", "any", "laser"] },
            { name: "IPL Photofacial", description: "Light therapy to treat sun damage, age spots, and rosacea for even skin tone.", price: "From $350", img: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=100&h=100&fit=crop", keywords: ["brightness", "some", "any", "laser"] },
            { name: "Microneedling", description: "Stimulate collagen production for smoother, firmer, younger-looking skin.", price: "From $400", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=100&h=100&fit=crop", keywords: ["aging", "acne", "some", "any", "laser"] },
            { name: "Laser Skin Resurfacing", description: "Advanced treatment for deep wrinkles, scars, and significant skin renewal.", price: "From $800", img: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=100&h=100&fit=crop", keywords: ["aging", "brightness", "any", "laser"] }
        ]
    }
};

let currentQuestion = 0;
let answers = {};

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const quizCard = document.getElementById('quizCard');
const resultSection = document.getElementById('resultSection');
const resultCards = document.getElementById('resultCards');
const retakeBtn = document.getElementById('retakeBtn');

function initQuiz() {
    currentQuestion = 0;
    answers = {};
    resultSection.style.display = 'none';
    quizCard.style.display = 'block';
    document.querySelector('.quiz-progress').style.display = 'block';
    document.querySelector('.quiz-nav').style.display = 'flex';
    renderQuestion();
}

function renderQuestion() {
    const question = questions[currentQuestion];
    questionText.textContent = question.question;
    progressText.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
    progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;

    optionsContainer.innerHTML = '';
    const selectedAnswers = answers[currentQuestion] || [];
    
    question.options.forEach((option) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        if (selectedAnswers.includes(option.value)) {
            btn.classList.add('selected');
        }
        btn.innerHTML = `
            <img src="${option.img}" alt="${option.text}" class="option-img">
            <span class="option-text">${option.text}</span>
        `;
        btn.addEventListener('click', () => toggleOption(option.value));
        optionsContainer.appendChild(btn);
    });

    prevBtn.disabled = currentQuestion === 0;
    nextBtn.disabled = !answers[currentQuestion] || answers[currentQuestion].length === 0;
    nextBtn.textContent = currentQuestion === questions.length - 1 ? 'See Results' : 'Next';
}

function toggleOption(value) {
    if (!answers[currentQuestion]) {
        answers[currentQuestion] = [];
    }
    
    const index = answers[currentQuestion].indexOf(value);
    
    if (index > -1) {
        answers[currentQuestion].splice(index, 1);
    } else {
        if (answers[currentQuestion].length < 2) {
            answers[currentQuestion].push(value);
        } else {
            return;
        }
    }
    
    renderQuestion();
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        renderQuestion();
    } else {
        showResults();
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
}

function showResults() {
    const allAnswers = Object.values(answers).flat();
    const treatmentScores = {};
    
    Object.values(treatmentDatabase).forEach(category => {
        category.treatments.forEach(treatment => {
            const matchCount = treatment.keywords.filter(keyword => allAnswers.includes(keyword)).length;
            if (matchCount > 0) {
                if (!treatmentScores[treatment.name]) {
                    treatmentScores[treatment.name] = {
                        ...treatment,
                        score: matchCount
                    };
                } else {
                    treatmentScores[treatment.name].score += matchCount;
                }
            }
        });
    });
    
    const sortedTreatments = Object.values(treatmentScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    
    if (sortedTreatments.length === 0) {
        resultCards.innerHTML = `
            <div class="result-card">
                <div class="result-card-img" style="font-size: 3rem;">💡</div>
                <h3>Let's Get Started</h3>
                <p>Schedule a consultation and our experts will help you find the perfect treatment!</p>
                <span class="price">Personalized Assessment</span>
                <a href="book.html" class="btn btn-primary btn-small">Book Consultation</a>
            </div>
        `;
    } else {
        resultCards.innerHTML = sortedTreatments.map(t => `
            <div class="result-card">
                <img src="${t.img}" alt="${t.name}" class="result-card-img">
                <h3>${t.name}</h3>
                <p>${t.description}</p>
                <span class="price">${t.price}</span>
                <a href="book.html" class="btn btn-primary btn-small">Book Now</a>
            </div>
        `).join('');
    }

    quizCard.style.display = 'none';
    document.querySelector('.quiz-progress').style.display = 'none';
    document.querySelector('.quiz-nav').style.display = 'none';
    resultSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

nextBtn.addEventListener('click', nextQuestion);
prevBtn.addEventListener('click', prevQuestion);
retakeBtn.addEventListener('click', initQuiz);

initQuiz();