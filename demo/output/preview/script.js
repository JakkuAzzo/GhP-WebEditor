// Sports Central Interactive Features
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sports Central Loaded! ⚽🏀🎾');
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Live score updates (demo)
    const scores = document.querySelectorAll('.score');
    setInterval(() => {
        scores.forEach(score => {
            if (score.closest('.match-card').querySelector('.live-badge')) {
                // Randomly update scores for live matches
                if (Math.random() > 0.95) {
                    const currentScore = score.textContent.split(' - ');
                    const team1Score = parseInt(currentScore[0]);
                    const team2Score = parseInt(currentScore[2]);
                    if (Math.random() > 0.5) {
                        score.textContent = `${team1Score + 1} - ${team2Score}`;
                    } else {
                        score.textContent = `${team1Score} - ${team2Score + 1}`;
                    }
                }
            }
        });
    }, 5000);
    
    // CTA button interaction
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            alert('🎉 Live streaming feature coming soon! Stay tuned for real-time sports action.');
        });
    }
    
    // Animate stats on scroll
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach(stat => {
                    stat.style.animation = 'countUp 1s ease-out';
                });
            }
        });
    }, observerOptions);
    
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        observer.observe(statsSection);
    }
});

// Add count-up animation
const style = document.createElement('style');
style.textContent = `
    @keyframes countUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);