class DashboardFX {
    constructor() {
        this.canvas = document.getElementById('dashboard-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'dashboard-canvas';
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');

        this.particles = [];
        this.trail = [];
        this.mouse = { x: -100, y: -100 };
        this.lastMouse = { x: -100, y: -100 };
        this.idleTime = 0;

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        this.resize();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.idleTime = 0;

        // Spawn particles based on speed
        const dx = this.mouse.x - this.lastMouse.x;
        const dy = this.mouse.y - this.lastMouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // More particles for faster movement
        const count = Math.min(5, Math.floor(dist / 2));

        for (let i = 0; i < count; i++) {
            this.addParticle(
                this.mouse.x - dx * (i / count), // Interpolate position
                this.mouse.y - dy * (i / count),
                dist
            );
        }

        this.lastMouse.x = this.mouse.x;
        this.lastMouse.y = this.mouse.y;
    }

    addParticle(x, y, speed) {
        const spread = speed * 0.1;
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * spread,
            vy: (Math.random() - 0.5) * spread,
            life: 1.0,
            decay: 0.01 + Math.random() * 0.03,
            size: Math.random() * 3 + 1,
            color: Math.random() > 0.5 ? '#ff0000' : '#ff5500' // Red/Orange mix
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Check visibility (Only show on Dashboard, hide on Login)
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen && getComputedStyle(loginScreen).display !== 'none') {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Composite operation for glowing effect
        this.ctx.globalCompositeOperation = 'lighter';

        // Update & Draw Particles (Sparks)
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.size *= 0.95; // Shrink

            if (p.life <= 0 || p.size < 0.1) {
                this.particles.splice(i, 1);
                i--;
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 69, 0, ${p.life})`; // Red-Orange
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.fill();
        }

        // Draw Mouse Trail (Electric Line)
        this.trail.unshift({ x: this.mouse.x, y: this.mouse.y });
        if (this.trail.length > 20) this.trail.pop();

        if (this.trail.length > 1) {
            this.ctx.beginPath();
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = 'red';
            this.ctx.strokeStyle = '#ff3333';
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            this.ctx.moveTo(this.trail[0].x, this.trail[0].y);
            // Draw smooth curve through trail points
            for (let i = 1; i < this.trail.length - 1; i++) {
                const xc = (this.trail[i].x + this.trail[i + 1].x) / 2;
                const yc = (this.trail[i].y + this.trail[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(this.trail[i].x, this.trail[i].y, xc, yc);

                // Taper width
                this.ctx.lineWidth = 3 * (1 - i / this.trail.length);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(xc, yc);
            }
            this.ctx.stroke();
        }

        // Reset composite
        this.ctx.globalCompositeOperation = 'source-over';

        // Clean up idle trail
        this.idleTime++;
        if (this.idleTime > 10) {
            if (this.trail.length > 0) this.trail.pop();
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Only init if not already existing (singleton check usually needed but basic script replace works too)
    // We overwrite the file so this is fine.
    if (document.querySelector('script[src="dashboard-fx.js"]')) {
        new DashboardFX();
    }
});
// Update
