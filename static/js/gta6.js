"use strict";

class NeonCoastGame {
    constructor() {
        this.buildings = [];
        const colors = ["#574c70", "#3e6170", "#806078", "#426b68", "#69607e"];
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
            this.buildings.push({ x: 265 + x * 400, y: 265 + y * 400, w: 270, h: 270, color: colors[(x + y * 2) % colors.length] });
        }
        this.reset();
        this.state = "idle";
    }
    reset() {
        this.player = { x: 200, y: 200, angle: 0, speed: 0 };
        this.health = 100;
        this.cash = this.deliveries = this.heat = this.time = this.safeTime = this.damageCooldown = 0;
        this.state = "running";
        this.job = { x: 600, y: 200, carrying: false };
        this.police = [];
        this.traffic = Array.from({ length: 24 }, (_, i) => ({
            x: i < 12 ? 200 + (i % 6) * 400 : 100 + ((i * 173) % 2200),
            y: i < 12 ? 100 + ((i * 277) % 2200) : 200 + (i % 6) * 400,
            axis: i < 12 ? "y" : "x", direction: i % 2 ? 1 : -1, speed: 65 + i % 4 * 12,
            color: ["#faad77", "#a8cbe3", "#f2b6d7", "#a7d4b2"][i % 4],
        }));
    }
    blocked(x, y) {
        return x < 95 || x > 2305 || y < 95 || y > 2305 || this.buildings.some(b => x > b.x - 12 && x < b.x + b.w + 12 && y > b.y - 12 && y < b.y + b.h + 12);
    }
    damage(amount) {
        if (this.damageCooldown > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.heat = Math.min(5, this.heat + 1);
        this.safeTime = 0;
        this.damageCooldown = 1;
        if (this.health === 0) this.state = "over";
    }
    pause() {
        if (this.state === "running") this.state = "paused";
        else if (this.state === "paused") this.state = "running";
    }
    update(delta, keys = {}) {
        if (this.state !== "running") return;
        this.time += delta;
        this.damageCooldown = Math.max(0, this.damageCooldown - delta);
        const p = this.player;
        if (keys.up) p.speed += 170 * delta;
        else if (keys.down) p.speed -= 150 * delta;
        else p.speed *= Math.exp(-1.2 * delta);
        if (keys.brake) p.speed *= Math.exp(-7 * delta);
        const topSpeed = keys.boost && keys.up ? 330 : 220;
        p.speed = Math.max(-95, Math.min(topSpeed, p.speed));
        const steering = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        p.angle += steering * 2.5 * delta * Math.min(1, Math.abs(p.speed) / 70) * (p.speed < 0 ? -1 : 1);
        const nextX = p.x + Math.cos(p.angle) * p.speed * delta;
        const nextY = p.y + Math.sin(p.angle) * p.speed * delta;
        if (this.blocked(nextX, nextY)) {
            if (Math.abs(p.speed) > 55) this.damage(Math.min(22, Math.abs(p.speed) / 12));
            p.speed *= -.3;
        } else { p.x = nextX; p.y = nextY; }
        for (const car of this.traffic) {
            car[car.axis] += car.direction * car.speed * delta;
            if (car[car.axis] > 2300) car[car.axis] = 100;
            if (car[car.axis] < 100) car[car.axis] = 2300;
            if (Math.hypot(car.x - p.x, car.y - p.y) < 27) { this.damage(12); p.speed *= -.4; }
        }
        if (this.state === "over") return;
        const wanted = Math.ceil(this.heat);
        while (this.police.length < wanted) {
            const i = this.police.length;
            // Spawn patrols on a road outside the player's immediate view.
            this.police.push({ x: p.x < 1200 ? 2200 : 200, y: 200 + i % 6 * 400, angle: 0 });
        }
        while (this.police.length > wanted) this.police.pop();
        let chased = false;
        for (const car of this.police) {
            const distance = Math.hypot(car.x - p.x, car.y - p.y);
            if (distance < 330) chased = true;
            // Travel along road intersections, then approach the car on its road.
            const cx = 200 + Math.round((car.x - 200) / 400) * 400;
            const cy = 200 + Math.round((car.y - 200) / 400) * 400;
            if (!car.target || Math.hypot(car.x - car.target.x, car.y - car.target.y) < 6) {
                const tx = 200 + Math.round((p.x - 200) / 400) * 400;
                const ty = 200 + Math.round((p.y - 200) / 400) * 400;
                const dx = tx - cx, dy = ty - cy;
                car.target = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? { x: cx + Math.sign(dx) * 400, y: cy } : dy !== 0 ? { x: cx, y: cy + Math.sign(dy) * 400 } : { x: p.x, y: p.y };
            }
            const dx = car.target.x - car.x, dy = car.target.y - car.y;
            const length = Math.hypot(dx, dy);
            const step = Math.min(length, (120 + wanted * 12) * delta);
            if (length > 0) {
                const x = car.x + dx / length * step, y = car.y + dy / length * step;
                if (!this.blocked(x, y)) { car.x = x; car.y = y; car.angle = Math.atan2(dy, dx); }
                else car.target = { x: cx, y: cy };
            }
            if (distance < 30) { this.damage(9); p.speed *= .8; }
        }
        if (this.state === "over") return;
        if (chased) this.safeTime = 0;
        else this.safeTime += delta;
        if (this.safeTime > 10 && this.heat > 0) { this.heat = Math.max(0, this.heat - 1); this.safeTime = 0; }
        if (Math.hypot(p.x - this.job.x, p.y - this.job.y) < 38) {
            if (this.job.carrying) {
                this.cash += 500 + this.deliveries * 100;
                this.deliveries++;
                this.health = Math.min(100, this.health + 25);
                this.job = { x: 200 + ((this.deliveries * 3 + 1) % 6) * 400, y: 200 + ((this.deliveries * 2) % 6) * 400, carrying: false };
            } else {
                this.job = { x: 200 + ((this.deliveries * 2 + 4) % 6) * 400, y: 200 + ((this.deliveries * 3 + 4) % 6) * 400, carrying: true };
            }
        }
    }
}

(() => {
    const canvas = document.getElementById("gta-board");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const game = new NeonCoastGame();
    const width = 960, height = 600;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale);
    const keys = {};
    const start = document.getElementById("gta-start"), pause = document.getElementById("gta-pause");
    let animation, last = 0;
    function clearKeys() { for (const key of Object.keys(keys)) delete keys[key]; }
    function car(x, y, angle, color, police = false) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = "#0005"; ctx.fillRect(-17, -10, 38, 24);
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-19, -10, 38, 20, 5); ctx.fill();
        ctx.fillStyle = "#173547"; ctx.fillRect(-7, -8, 15, 16);
        ctx.fillStyle = "#eef4c8"; ctx.fillRect(16, -8, 3, 4); ctx.fillRect(16, 4, 3, 4);
        ctx.fillStyle = "#ff5d75"; ctx.fillRect(-19, -8, 3, 4); ctx.fillRect(-19, 4, 3, 4);
        if (police) { ctx.fillStyle = Math.floor(game.time * 8) % 2 ? "#ff477f" : "#5faaff"; ctx.fillRect(-2, -8, 4, 16); }
        ctx.restore();
    }
    function marker(x, y, color, size = 27) {
        ctx.strokeStyle = color; ctx.fillStyle = color + "25"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, size + Math.sin(game.time * 4) * 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText(game.job.carrying ? "↓" : "$", x, y + 8);
    }
    function draw() {
        const p = game.player;
        const cameraX = Math.max(0, Math.min(2400 - width, p.x - width / 2));
        const cameraY = Math.max(0, Math.min(2400 - height, p.y - height / 2));
        ctx.fillStyle = "#234b50"; ctx.fillRect(0, 0, width, height);
        ctx.save(); ctx.translate(-cameraX, -cameraY);
        ctx.fillStyle = "#287480"; ctx.fillRect(0, 0, 2400, 2400);
        ctx.fillStyle = "#678b7d"; ctx.fillRect(80, 80, 2240, 2240);
        for (let i = 0; i < 6; i++) {
            const c = 200 + i * 400;
            ctx.fillStyle = "#a7ada1"; ctx.fillRect(c - 62, 80, 124, 2240); ctx.fillRect(80, c - 62, 2240, 124);
            ctx.fillStyle = "#303e4e"; ctx.fillRect(c - 50, 80, 100, 2240); ctx.fillRect(80, c - 50, 2240, 100);
        }
        ctx.strokeStyle = "#e9d3a575"; ctx.lineWidth = 2; ctx.setLineDash([16, 18]);
        for (let i = 0; i < 6; i++) {
            const c = 200 + i * 400;
            ctx.beginPath(); ctx.moveTo(c, 100); ctx.lineTo(c, 2300); ctx.moveTo(100, c); ctx.lineTo(2300, c); ctx.stroke();
        }
        ctx.setLineDash([]);
        for (const b of game.buildings) {
            ctx.fillStyle = "#10253755"; ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
            ctx.fillStyle = b.color; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
            ctx.strokeStyle = "#ffffff25"; ctx.lineWidth = 3; ctx.strokeRect(b.x + 15, b.y + 15, b.w - 30, b.h - 30);
            ctx.fillStyle = "#ffffff15"; ctx.fillRect(b.x + 40, b.y + 40, 70, 90); ctx.fillRect(b.x + 150, b.y + 40, 70, 90);
            ctx.fillStyle = "#f7bdce"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
            ctx.fillText(["NEON HOTEL", "OCEAN DRIVE", "SUNSET MALL", "PALM PLAZA"][(Math.floor(b.x / 400) + Math.floor(b.y / 400)) % 4], b.x + 30, b.y + 220);
            for (const [x, y] of [[b.x - 9, b.y + 30], [b.x + b.w + 9, b.y + b.h - 30]]) {
                ctx.fillStyle = "#204b45"; ctx.beginPath(); ctx.arc(x + 4, y + 4, 15, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = "#66b092"; ctx.lineWidth = 4;
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); ctx.stroke(); }
            }
        }
        marker(game.job.x, game.job.y, game.job.carrying ? "#7cf1b6" : "#ffd36b");
        for (const t of game.traffic) car(t.x, t.y, t.axis === "x" ? (t.direction > 0 ? 0 : Math.PI) : (t.direction > 0 ? Math.PI / 2 : -Math.PI / 2), t.color);
        for (const t of game.police) car(t.x, t.y, t.angle, "#e6edf4", true);
        if (game.damageCooldown <= 0 || Math.floor(game.time * 12) % 2) car(p.x, p.y, p.angle, "#f17dc6");
        ctx.restore();
        // Minimap shows the entire city, the job and approaching patrols.
        ctx.save(); ctx.translate(width - 162, 14);
        ctx.fillStyle = "#0e1c32de"; ctx.beginPath(); ctx.roundRect(0, 0, 148, 148, 8); ctx.fill();
        ctx.strokeStyle = "#718da477"; ctx.lineWidth = 5;
        for (let i = 0; i < 6; i++) { const c = 10 + (200 + i * 400) / 2400 * 128; ctx.beginPath(); ctx.moveTo(c, 10); ctx.lineTo(c, 138); ctx.moveTo(10, c); ctx.lineTo(138, c); ctx.stroke(); }
        for (const [point, color] of [[game.job, game.job.carrying ? "#7cf1b6" : "#ffd36b"], ...game.police.map(t => [t, "#70aaff"]), [p, "#f88bd0"]]) {
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(10 + point.x / 2400 * 128, 10 + point.y / 2400 * 128, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = "#101b30dd"; ctx.beginPath(); ctx.roundRect(16, height - 63, 390, 47, 8); ctx.fill();
        ctx.fillStyle = "#f4e5f5"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "left";
        const distance = Math.round(Math.hypot(game.job.x - p.x, game.job.y - p.y));
        ctx.fillText(`${game.job.carrying ? "DELIVER" : "PICKUP"} · ${distance} m    |    ${Math.round(Math.abs(p.speed) / 3)} km/h`, 30, height - 34);
        if (game.state !== "running") {
            ctx.fillStyle = "#101528c9"; ctx.fillRect(0, 0, width, height);
            ctx.textAlign = "center"; ctx.fillStyle = "#ffa3d8"; ctx.font = "bold 46px sans-serif";
            ctx.fillText(game.state === "over" ? "WRECKED" : game.state === "paused" ? "PAUSED" : "NEON COAST", width / 2, height / 2 - 16);
            ctx.fillStyle = "#f2e6f6"; ctx.font = "18px sans-serif";
            ctx.fillText(game.state === "over" ? `Earned $${game.cash} · ${game.deliveries} deliveries · Try again` : game.state === "paused" ? "Press P or Resume to continue" : "Pick up jobs. Cruise the coast. Lose the cops.", width / 2, height / 2 + 26);
        }
        for (const [id, value] of [["cash", `$${game.cash}`], ["deliveries", game.deliveries], ["health", `${Math.ceil(game.health)}%`], ["wanted", "★".repeat(Math.ceil(game.heat)) + "☆".repeat(5 - Math.ceil(game.heat))]]) {
            const field = document.getElementById(`gta-${id}`); if (field.textContent !== String(value)) field.textContent = value;
        }
        start.textContent = game.state === "idle" ? "Start driving" : game.state === "over" ? "Try again" : "Restart";
        pause.disabled = !["running", "paused"].includes(game.state); pause.textContent = game.state === "paused" ? "Resume" : "Pause";
        const message = game.state === "paused" ? "Game paused." : game.state === "over" ? `Car wrecked. You earned $${game.cash}.` : game.job.carrying ? "Delivery on board — follow the green marker. Complete the job for cash and repairs." : "Pick up a job at the yellow marker, then drive to the green destination.";
        const status = document.getElementById("gta-status"); if (status.textContent !== message) status.textContent = message;
    }
    function frame(timestamp) {
        game.update(last ? Math.min(.04, (timestamp - last) / 1000) : 0, keys); last = timestamp;
        draw(); animation = requestAnimationFrame(frame);
    }
    start.addEventListener("click", () => { clearKeys(); game.reset(); canvas.focus({ preventScroll: true }); });
    pause.addEventListener("click", () => { clearKeys(); game.pause(); canvas.focus({ preventScroll: true }); });
    const bindings = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", " ": "brake", Shift: "boost" };
    canvas.addEventListener("keydown", event => {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key in bindings) { event.preventDefault(); keys[bindings[key]] = true; }
        else if (["p", "Escape", "Enter", "r"].includes(key) && !event.repeat) {
            event.preventDefault(); clearKeys();
            if (key === "r" || (key === "Enter" && ["idle", "over"].includes(game.state))) game.reset();
            else game.pause();
        }
    });
    window.addEventListener("keyup", event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (key in bindings) delete keys[bindings[key]]; });
    for (const button of document.querySelectorAll("[data-gta-control]")) {
        button.addEventListener("pointerdown", event => { event.preventDefault(); keys[button.dataset.gtaControl] = true; button.setPointerCapture(event.pointerId); });
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(name, () => { delete keys[button.dataset.gtaControl]; });
        button.addEventListener("keydown", event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); keys[button.dataset.gtaControl] = true; } });
        button.addEventListener("keyup", () => { delete keys[button.dataset.gtaControl]; });
        button.addEventListener("blur", () => { delete keys[button.dataset.gtaControl]; });
    }
    function leave() { clearKeys(); if (game.state === "running") game.pause(); }
    canvas.addEventListener("blur", clearKeys);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", () => { if (document.hidden) leave(); });
    window.addEventListener("pagehide", () => { leave(); cancelAnimationFrame(animation); });
    window.addEventListener("pageshow", event => { if (event.persisted) { last = 0; animation = requestAnimationFrame(frame); } });
    animation = requestAnimationFrame(frame);
})();
