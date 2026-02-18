class Dragon {
    constructor() {
        this.container = document.getElementById('dragon-container');
        if (!this.container) return;

        this.segments = [];
        this.numSegments = 50; // Longer body
        this.trail = [];
        this.spacing = 8; // Spacing between scale segments
        this.maxTrailLength = this.numSegments * this.spacing + 100;

        this.headX = window.innerWidth / 2;
        this.headY = window.innerHeight / 2;

        // Autopilot vars
        this.t = 0;

        this.createDragon();
        this.animate();
    }

    createDragon() {
        // --- 1. Create Head (SVG) ---
        const head = document.createElement('div');
        head.className = 'dragon-segment dragon-head';

        // Dragon Head SVG (Simplified abstract dragon/snake head)
        head.innerHTML = `
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <path d="M438.6 150.8c-10.7-14.7-27.4-23.7-44.6-26.6-42.5-7.3-85.3 11-120.6 42.6-32.5 29.1-60.6 62.7-84.3 98.4-5.3 8-10.3 16.1-15 24.5-4.4-15-11.7-29.2-21.8-41.8-31-38.3-80-49.8-125.2-34.8-13.8 4.6-26.5 11.7-37.4 20.8 19.4 6 36.3 17.7 47.9 33.5 19.3 26.2 21.6 61.3 6.6 89.2-3 5.6-6.6 11-10.8 15.9 31 16.5 68.8 15 97.4-4.8 15.6-10.8 28.5-24.8 38.3-41 18.2-30.8 40.5-59.5 66.2-85.3 25-25.2 53.6-43.2 84.8-54 13.6-4.7 27.6-6.6 41.5-5.9 5.8 0.3 11.5 1.2 17.1 2.8 18.2 5.2 33.7 17.6 42.8 34.1 9.2 16.7 11.6 36.5 6.6 55-6.8 25.4-25.2 46.5-48.5 56.4-9.3 4-19.4 6-29.5 5.9-4.8 0-9.6-0.5-14.3-1.4-18.7-3.8-35.3-13.8-47.5-28.8-4.2-5.2-7.8-11-10.6-17.1s-4.8-12.6-5.8-19.3c-1.9-13.6 1.4-27.6 9.3-38.6 7.8-10.8 19.5-18.1 32.5-20.2 16.2-2.6 32.7 3.2 44.5 15.3 5.6 5.8 10 12.7 12.8 20.3 6.9-15.6 7.6-33.5 1.5-49.6z M170 310c10-10 20-20 30-30 0 0-40 40-30 30z" fill="url(#dragon-gradient)"/>
            <defs>
                <linearGradient id="dragon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ff4500;stop-opacity:1" />
                </linearGradient>
            </defs>
        </svg>
        `;

        // Initial positioning
        head.style.left = `${this.headX}px`;
        head.style.top = `${this.headY}px`;
        head.style.width = '100px';
        head.style.height = '100px';
        head.style.transformOrigin = "center center";
        head.style.zIndex = 200;

        this.container.appendChild(head);
        this.segments.push(head);

        // --- 2. Create Body Scales ---
        for (let i = 1; i < this.numSegments; i++) {
            const scale = document.createElement('div');
            scale.className = 'dragon-segment';

            // Size tapering
            const size = Math.max(10, 40 - (i * 0.5));
            scale.style.width = `${size}px`;
            scale.style.height = `${size}px`;
            scale.style.zIndex = 100 - i;

            this.container.appendChild(scale);
            this.segments.push(scale);
        }
    }

    animate() {
        this.t += 0.01;

        // --- Head Movement Logic (Sinuous Path) ---
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const rX = window.innerWidth * 0.45;
        const rY = window.innerHeight * 0.4;

        // Complex Lissajous-like curve for natural wandering
        let x = cx + Math.cos(this.t) * rX + Math.sin(this.t * 2.3) * 100;
        let y = cy + Math.sin(this.t * 1.5) * rY + Math.cos(this.t * 1.8) * 80;

        // Calculate angle for head rotation (atan2 of delta)
        const dx = x - this.headX;
        const dy = y - this.headY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90 to align SVG if needed

        this.headX = x;
        this.headY = y;

        // Apply to Head
        const head = this.segments[0];
        head.style.left = `${x}px`;
        head.style.top = `${y}px`;

        // Rotate head to face direction
        // The SVG might need offset depending on its drawing
        // Assuming SVG points UP, we add 90 or 180 deg? 
        // Let's try matching the tangent.
        head.style.transform = `translate(-50%, -50%) rotate(${angle - 45}deg)`;

        // --- Trail Management ---
        this.trail.unshift({ x: this.headX, y: this.headY, angle: angle });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.pop();
        }

        // --- Update Body Segments ---
        this.segments.forEach((seg, index) => {
            if (index === 0) return; // Skip head

            const trailIndex = index * this.spacing;
            if (this.trail[trailIndex]) {
                const pos = this.trail[trailIndex];

                seg.style.left = `${pos.x}px`;
                seg.style.top = `${pos.y}px`;

                // Rotate scales to flow with body
                seg.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dragon-container')) {
        new Dragon();
    }
});
