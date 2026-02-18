class LuxuryBackground {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'luxury-canvas';
        this.ctx = this.canvas.getContext('2d');

        // Find existing container or append to body
        const container = document.getElementById('luxury-container');
        if (container) {
            container.appendChild(this.canvas);
        } else {
            // Backup
            document.body.appendChild(this.canvas);
        }

        this.particles = [];
        this.numParticles = 80;
        this.mouse = { x: null, y: null, radius: 250 };
        this.trail = [];
        this.shootingStars = []; // Added shooting stars

        // Resize listener
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => this.mouseMove(e));

        this.resize();
        this.createParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    mouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;

        // Add trail point
        this.trail.push({ x: e.clientX, y: e.clientY, size: 20, opacity: 1 });
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 1.5, // Faster drift
                vy: (Math.random() - 0.5) * 1.5,
                size: Math.random() * 2 + 1,
                color: '#ffd700'
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawMouseTrail();
        this.connectParticles();
        this.drawShootingStars(); // New method call

        // Randomly spawn shooting star
        if (Math.random() < 0.02) {
            this.createShootingStar();
        }

        // Update and draw particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Bounce off edges
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            // --- Enhanced Mouse Interaction (Magnet Effect) ---
            if (this.mouse.x != null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.mouse.radius) {
                    const angle = Math.atan2(dy, dx);
                    // Swirl effect
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    // Move towards mouse
                    p.vx += Math.cos(angle) * force * 0.2;
                    p.vy += Math.sin(angle) * force * 0.2;

                    // Add subtle rotation/swirl perpendicular to radius
                    p.vx -= Math.sin(angle) * force * 0.1;
                    p.vy += Math.cos(angle) * force * 0.1;
                }
            }

            // Friction to stop infinite acceleration
            p.vx *= 0.98;
            p.vy *= 0.98;

            // Draw Dot
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 215, 0, ${0.6 + Math.random() * 0.4})`;
            this.ctx.fill();
        });
    }

    createShootingStar() {
        this.shootingStars.push({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height * 0.5, // Start from top half
            vx: Math.random() * 10 + 5,
            vy: Math.random() * 10 + 5,
            len: Math.random() * 80 + 20,
            opacity: 1
        });
    }

    drawShootingStars() {
        for (let i = 0; i < this.shootingStars.length; i++) {
            const s = this.shootingStars[i];
            s.x += s.vx;
            s.y += s.vy;
            s.opacity -= 0.02;

            if (s.opacity <= 0 || s.x > this.canvas.width || s.y > this.canvas.height) {
                this.shootingStars.splice(i, 1);
                i--;
                continue;
            }

            const gradient = this.ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 2, s.y - s.vy * 2);
            gradient.addColorStop(0, `rgba(255, 215, 0, ${s.opacity})`);
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(s.x, s.y);
            this.ctx.lineTo(s.x - s.vx * 2, s.y - s.vy * 2);
            this.ctx.stroke();
        }
    }

    drawMouseTrail() {
        // Update and draw trail
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            point.opacity -= 0.05; // Fade out quickly
            point.size *= 0.9;

            if (point.opacity <= 0) {
                this.trail.splice(i, 1);
                i--;
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 215, 0, ${point.opacity * 0.5})`; // Gold dust
            this.ctx.fill();
        }
    }

    connectParticles() {
        const connectionDistance = 150;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < connectionDistance) {
                    const opacity = 1 - (distance / connectionDistance);
                    this.ctx.strokeStyle = `rgba(255, 215, 0, ${opacity * 0.4})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('luxury-container')) {
        new LuxuryBackground();
    }
});
