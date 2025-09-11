// Interactive features for Subnetting Basics page

document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers for practice problem answers
    const showAnswerButtons = document.querySelectorAll('.show-answer');
    showAnswerButtons.forEach(button => {
        button.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            if (answer.classList.contains('hidden')) {
                answer.classList.remove('hidden');
                this.textContent = 'Hide Answer';
            } else {
                answer.classList.add('hidden');
                this.textContent = 'Show Answer';
            }
        });
    });

    // Progress tracker functionality
    const progressSteps = document.querySelectorAll('.progress-step');
    const sections = document.querySelectorAll('section[id]');

    function updateProgress() {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;

        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (scrollPosition >= sectionTop - windowHeight / 2 &&
                scrollPosition < sectionTop + sectionHeight - windowHeight / 2) {
                progressSteps.forEach(step => step.classList.remove('active'));
                if (progressSteps[index]) {
                    progressSteps[index].classList.add('active');
                }
            }
        });
    }

    window.addEventListener('scroll', updateProgress);
    updateProgress(); // Initial call

    // Smooth scrolling for navigation
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Add hover effects for tables
    const tableRows = document.querySelectorAll('table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0f8ff';
        });
        row.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });
    });

    // Binary calculator demo
    const binaryInputs = document.querySelectorAll('.binary-input');
    binaryInputs.forEach(input => {
        input.addEventListener('input', function() {
            const decimal = parseInt(this.value) || 0;
            const binary = decimal.toString(2).padStart(8, '0');
            const binaryOutput = this.parentElement.querySelector('.binary-output');
            if (binaryOutput) {
                binaryOutput.textContent = binary;
            }
        });
    });

    // Quiz functionality (if quiz section exists)
    const quizQuestions = document.querySelectorAll('.quiz-question');
    if (quizQuestions.length > 0) {
        let currentQuestion = 0;
        const totalQuestions = quizQuestions.length;

        function showQuestion(index) {
            quizQuestions.forEach((question, i) => {
                question.style.display = i === index ? 'block' : 'none';
            });
            updateQuizProgress();
        }

        function updateQuizProgress() {
            const progress = ((currentQuestion + 1) / totalQuestions) * 100;
            const progressBar = document.querySelector('.quiz-progress');
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
        }

        // Add next/previous button functionality
        const nextButtons = document.querySelectorAll('.next-question');
        nextButtons.forEach(button => {
            button.addEventListener('click', function() {
                if (currentQuestion < totalQuestions - 1) {
                    currentQuestion++;
                    showQuestion(currentQuestion);
                }
            });
        });

        const prevButtons = document.querySelectorAll('.prev-question');
        prevButtons.forEach(button => {
            button.addEventListener('click', function() {
                if (currentQuestion > 0) {
                    currentQuestion--;
                    showQuestion(currentQuestion);
                }
            });
        });

        showQuestion(currentQuestion);
    }

    // Add copy functionality for code examples
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.className = 'copy-button';
        copyButton.addEventListener('click', function() {
            navigator.clipboard.writeText(block.textContent).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = 'Copy';
                }, 2000);
            });
        });
        block.parentElement.appendChild(copyButton);
    });

    // Add search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const sections = document.querySelectorAll('section');

            sections.forEach(section => {
                const text = section.textContent.toLowerCase();
                if (text.includes(searchTerm) || searchTerm === '') {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        });
    }

    // Add dark mode toggle
    const darkModeToggle = document.querySelector('.dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            this.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        });

        // Load saved dark mode preference
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'true') {
            document.body.classList.add('dark-mode');
            darkModeToggle.textContent = '☀️ Light Mode';
        }
    }

    // Add print functionality
    const printButton = document.querySelector('.print-button');
    if (printButton) {
        printButton.addEventListener('click', function() {
            window.print();
        });
    }

    // Add bookmark functionality
    const bookmarkButtons = document.querySelectorAll('.bookmark-btn');
    bookmarkButtons.forEach(button => {
        button.addEventListener('click', function() {
            const section = this.closest('section');
            const sectionId = section.id;
            const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');

            if (bookmarks.includes(sectionId)) {
                bookmarks.splice(bookmarks.indexOf(sectionId), 1);
                this.textContent = '🔖 Bookmark';
            } else {
                bookmarks.push(sectionId);
                this.textContent = '✅ Bookmarked';
            }

            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        });
    });

    // Load bookmarks on page load
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    bookmarks.forEach(bookmarkId => {
        const section = document.getElementById(bookmarkId);
        if (section) {
            const bookmarkBtn = section.querySelector('.bookmark-btn');
            if (bookmarkBtn) {
                bookmarkBtn.textContent = '✅ Bookmarked';
            }
        }
    });
});
