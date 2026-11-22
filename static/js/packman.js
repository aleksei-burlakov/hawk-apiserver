"use strict";

class PackmanGame {
    static maze = [
        "###################", "#o.......#.......o#", "#.##.###.#.###.##.#",
        "#.................#", "#.##.#.#####.#.##.#", "#....#...#...#....#",
        "####.### # ###.####", "####.#       #.####", "####.# ## ## #.####",
        ".....  #   #  .....", "####.# ##### #.####", "####.#       #.####",
        "####.# ##### #.####", "#........#........#", "#.##.###.#.###.##.#",
        "#o.#..... .....#.o#", "##.#.#.#####.#.#.##", "#....#...#...#....#",
        "#.######.#.######.#", "#.................#", "###################",
    ];
    static directions = [[-1, 0], [0, -1], [1, 0], [0, 1]];

    constructor() {
        this.best = 0;
        try { this.best = Number(localStorage.getItem("hawk.packman.best")) || 0; } catch { /* Storage is optional. */ }
        this.reset();
        this.state = "idle";
    }
    reset() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.extraLife = 10000;
        this.time = 0;
        this.loadMaze();
        this.state = "running";
    }
    loadMaze() {
        this.board = PackmanGame.maze.map(row => row.split(""));
        this.remaining = this.board.flat().filter(tile => tile === "." || tile === "o").length;
        this.resetActors();
    }
    resetActors() {
        this.player = this.actor(9, 15, 0);
        this.wanted = 0;
        this.frightened = 0;
        this.combo = 0;
        this.roundTime = 0;
        this.playerClock = this.ghostClock = 0;
        this.ghosts = ["#ff5e70", "#ffacd2", "#59dbe8", "#ffbc67"].map((color, index) => ({
            ...this.actor(9, 9, index % 2 ? 2 : 0), color, index, returning: false, release: index * 1.5,
        }));
    }
    actor(x, y, direction) {
        return { x, y, direction, fromX: x, fromY: y, moved: this.time, duration: .12 };
    }
    destination(actor, direction) {
        const [dx, dy] = PackmanGame.directions[direction];
        const x = (actor.x + dx + 19) % 19;
        const y = actor.y + dy;
        return y >= 0 && y < this.board.length && this.board[y][x] !== "#" ? { x, y } : null;
    }
    move(actor, direction, duration) {
        const next = this.destination(actor, direction);
        if (!next) return false;
        actor.fromX = actor.x;
        actor.fromY = actor.y;
        actor.x = next.x;
        actor.y = next.y;
        actor.direction = direction;
        actor.moved = this.time;
        actor.duration = duration;
        return true;
    }
    addScore(points) {
        this.score += points;
        if (this.score >= this.extraLife) { this.lives++; this.extraLife = Infinity; }
        if (this.score > this.best) {
            this.best = this.score;
            try { localStorage.setItem("hawk.packman.best", String(this.best)); } catch { /* Storage is optional. */ }
        }
    }
    eat() {
        const tile = this.board[this.player.y][this.player.x];
        if (tile !== "." && tile !== "o") return;
        this.board[this.player.y][this.player.x] = " ";
        this.remaining--;
        this.addScore(tile === "o" ? 50 : 10);
        if (tile === "o") {
            this.frightened = Math.max(3, 8 - this.level * .4);
            this.combo = 0;
            for (const ghost of this.ghosts) if (!ghost.returning) ghost.direction = (ghost.direction + 2) % 4;
        }
    }
    distances(target) {
        const distances = new Map();
        const queue = [{ x: Math.round(target.x), y: Math.round(target.y) }];
        distances.set(`${queue[0].x},${queue[0].y}`, 0);
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            for (let direction = 0; direction < 4; direction++) {
                const next = this.destination(current, direction);
                if (!next) continue;
                const key = `${next.x},${next.y}`;
                if (distances.has(key)) continue;
                distances.set(key, distances.get(`${current.x},${current.y}`) + 1);
                queue.push(next);
            }
        }
        return distances;
    }
    ghostTarget(ghost) {
        if (ghost.returning) return { x: 9, y: 9 };
        const corners = [{ x: 17, y: 1 }, { x: 1, y: 1 }, { x: 17, y: 19 }, { x: 1, y: 19 }];
        if (this.roundTime % 27 < 7) return corners[ghost.index];
        if (ghost.index === 3 && Math.abs(ghost.x - this.player.x) + Math.abs(ghost.y - this.player.y) < 6) return corners[3];
        // The pink and cyan ghosts try to intercept instead of following directly.
        let target = { x: this.player.x, y: this.player.y };
        const ahead = ghost.index === 1 ? 4 : ghost.index === 2 ? 2 : 0;
        for (let i = 0; i < ahead; i++) {
            const next = this.destination(target, this.player.direction);
            if (!next) break;
            target = next;
        }
        return target;
    }
    moveGhost(ghost, duration) {
        if (this.roundTime < ghost.release) return;
        const choices = [0, 1, 2, 3].filter(direction => this.destination(ghost, direction));
        const forward = choices.filter(direction => direction !== (ghost.direction + 2) % 4);
        const available = ghost.returning || !forward.length ? choices : forward;
        if (!available.length) return;
        let direction;
        if (this.frightened > 0 && !ghost.returning) {
            direction = available[Math.floor(Math.random() * available.length)];
        } else {
            const distances = this.distances(this.ghostTarget(ghost));
            direction = available.reduce((best, candidate) => {
                const a = this.destination(ghost, best), b = this.destination(ghost, candidate);
                return (distances.get(`${b.x},${b.y}`) ?? Infinity) < (distances.get(`${a.x},${a.y}`) ?? Infinity) ? candidate : best;
            });
        }
        this.move(ghost, direction, duration);
        if (ghost.returning && ghost.x === 9 && ghost.y === 9) {
            ghost.returning = false;
            ghost.release = this.roundTime + 1.5;
        }
    }
    collisions() {
        for (const ghost of this.ghosts) {
            if (ghost.returning || this.roundTime < ghost.release) continue;
            if (ghost.x !== this.player.x || ghost.y !== this.player.y) continue;
            if (this.frightened > 0) {
                ghost.returning = true;
                this.addScore(200 * 2 ** Math.min(this.combo++, 3));
            } else {
                this.lives--;
                if (this.lives === 0) { this.state = "over"; return; }
                this.resetActors();
                this.state = "ready";
                this.readyTime = 1.5;
                return;
            }
        }
    }
    update(delta) {
        if (this.state === "ready") {
            this.readyTime -= delta;
            if (this.readyTime <= 0) this.state = "running";
            return;
        }
        if (this.state !== "running") return;
        this.time += delta;
        this.roundTime += delta;
        this.frightened = Math.max(0, this.frightened - delta);
        const playerInterval = Math.max(.075, .125 - (this.level - 1) * .005);
        const ghostInterval = this.frightened > 0 ? .21 : Math.max(.09, .155 - (this.level - 1) * .005);
        this.playerClock += delta;
        this.ghostClock += delta;
        if (this.playerClock >= playerInterval) {
            this.playerClock %= playerInterval;
            if (!this.move(this.player, this.wanted, playerInterval)) this.move(this.player, this.player.direction, playerInterval);
            this.eat();
            this.collisions();
            if (this.state !== "running") return;
            if (this.remaining === 0) {
                this.level++;
                this.loadMaze();
                this.state = "ready";
                this.readyTime = 2;
                return;
            }
        }
        if (this.ghostClock >= ghostInterval) {
            this.ghostClock %= ghostInterval;
            for (const ghost of this.ghosts) this.moveGhost(ghost, ghostInterval);
            this.collisions();
        }
    }
    pause() {
        if (this.state === "running") this.state = "paused";
        else if (this.state === "paused") this.state = "running";
    }
}

(() => {
    const canvas = document.getElementById("packman-board");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const game = new PackmanGame();
    const tile = 24, width = 19 * tile, height = 21 * tile;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    const start = document.getElementById("packman-start");
    const pause = document.getElementById("packman-pause");
    const status = document.getElementById("packman-status");
    let animation, last = 0;

    function position(actor) {
        const amount = Math.min(1, (game.time - actor.moved) / actor.duration);
        if (Math.abs(actor.x - actor.fromX) > 1) return { x: actor.x * tile + tile / 2, y: actor.y * tile + tile / 2 };
        return { x: (actor.fromX + (actor.x - actor.fromX) * amount) * tile + tile / 2, y: (actor.fromY + (actor.y - actor.fromY) * amount) * tile + tile / 2 };
    }
    function drawGhost(ghost) {
        const { x, y } = position(ghost);
        if (!ghost.returning) {
            context.fillStyle = game.frightened > 0 && game.roundTime >= ghost.release ? (game.frightened < 2 && Math.floor(game.time * 7) % 2 ? "#f3f6ff" : "#4665ef") : ghost.color;
            context.beginPath();
            context.arc(x, y - 1, 9, Math.PI, 0);
            context.lineTo(x + 9, y + 9);
            for (let i = 3; i >= 0; i--) context.lineTo(x - 9 + i * 6, y + (i % 2 ? 5 : 9));
            context.closePath(); context.fill();
        }
        const [dx, dy] = PackmanGame.directions[ghost.direction];
        for (const offset of [-4, 4]) {
            context.fillStyle = "white";
            context.beginPath(); context.ellipse(x + offset, y - 2, 3.5, 4.5, 0, 0, Math.PI * 2); context.fill();
            context.fillStyle = "#10264f";
            context.beginPath(); context.arc(x + offset + dx * 1.5, y - 2 + dy * 1.5, 1.8, 0, Math.PI * 2); context.fill();
        }
    }
    function draw() {
        context.fillStyle = "#071321";
        context.fillRect(0, 0, width, height);
        for (let y = 0; y < 21; y++) for (let x = 0; x < 19; x++) {
            const cell = game.board[y][x];
            if (cell === "#") {
                context.fillStyle = "#0d2442";
                context.strokeStyle = "#2373d4";
                context.lineWidth = 1.5;
                context.beginPath(); context.roundRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6, 5); context.fill(); context.stroke();
            } else if (cell === "." || cell === "o") {
                context.fillStyle = "#ffe5b0";
                context.beginPath(); context.arc(x * tile + 12, y * tile + 12, cell === "o" ? 5 + Math.sin(game.time * 6) : 2, 0, Math.PI * 2); context.fill();
            }
        }
        for (const ghost of game.ghosts) drawGhost(ghost);
        const player = position(game.player);
        const facing = [Math.PI, -Math.PI / 2, 0, Math.PI / 2][game.player.direction];
        const mouth = game.state === "running" ? .12 + .25 * Math.abs(Math.sin(game.time * 13)) : .22;
        context.fillStyle = "#ffda42";
        context.beginPath(); context.moveTo(player.x, player.y);
        context.arc(player.x, player.y, 9.5, facing + mouth, facing + Math.PI * 2 - mouth); context.closePath(); context.fill();
        if (game.state !== "running") {
            context.fillStyle = "#071321c9"; context.fillRect(0, height / 2 - 48, width, 96);
            context.textAlign = "center";
            context.fillStyle = "#ffda42"; context.font = "bold 25px sans-serif";
            const messages = { idle: "READY, PLAYER ONE?", paused: "PAUSED", ready: "READY!", over: "GAME OVER" };
            context.fillText(messages[game.state], width / 2, height / 2 - 4);
            context.fillStyle = "#c4d4e4"; context.font = "14px sans-serif";
            context.fillText(game.state === "ready" ? `Level ${game.level} · ${game.lives} lives` : game.state === "paused" ? "Press Space or Resume" : "Press Start or Enter", width / 2, height / 2 + 23);
        }
        for (const [id, value] of [["score", game.score], ["best", game.best], ["level", game.level], ["lives", game.lives]]) {
            const field = document.getElementById(`packman-${id}`);
            if (field.textContent !== String(value)) field.textContent = value;
        }
        start.textContent = ["idle", "over"].includes(game.state) ? (game.state === "over" ? "Play again" : "Start game") : "Restart";
        pause.disabled = !["running", "paused"].includes(game.state);
        pause.textContent = game.state === "paused" ? "Resume" : "Pause";
        const text = game.state === "running" ? "Eat every dot to clear the maze. Power pellets let you catch ghosts." : game.state === "over" ? `Game over. Final score: ${game.score}.` : game.state === "paused" ? "Game paused." : game.state === "ready" ? "Get ready!" : "Use arrow keys or WASD. Press Start to play.";
        if (status.textContent !== text) status.textContent = text;
    }
    function frame(timestamp) {
        const delta = last ? Math.min((timestamp - last) / 1000, .05) : 0;
        last = timestamp;
        game.update(delta); draw();
        animation = requestAnimationFrame(frame);
    }
    function direction(value) { game.wanted = value; canvas.focus({ preventScroll: true }); }
    start.addEventListener("click", () => { game.reset(); canvas.focus({ preventScroll: true }); });
    pause.addEventListener("click", () => { game.pause(); canvas.focus({ preventScroll: true }); });
    canvas.addEventListener("keydown", event => {
        const keys = { ArrowLeft: 0, a: 0, ArrowUp: 1, w: 1, ArrowRight: 2, d: 2, ArrowDown: 3, s: 3 };
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key in keys) { event.preventDefault(); direction(keys[key]); }
        else if ([" ", "p", "Escape"].includes(key)) { event.preventDefault(); game.pause(); }
        else if (key === "Enter" || key === "r") { event.preventDefault(); if (game.state === "paused" && key !== "r") game.pause(); else game.reset(); }
    });
    document.querySelectorAll("[data-packman-direction]").forEach(button => button.addEventListener("click", () => direction(Number(button.dataset.packmanDirection))));
    let touch;
    canvas.addEventListener("pointerdown", event => { touch = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointerup", event => {
        if (!touch) return;
        const dx = event.clientX - touch.x, dy = event.clientY - touch.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 12) direction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
        touch = null;
    });
    canvas.addEventListener("pointercancel", () => { touch = null; });
    document.addEventListener("visibilitychange", () => { if (document.hidden && game.state === "running") game.pause(); });
    window.addEventListener("blur", () => { if (game.state === "running") game.pause(); });
    window.addEventListener("pagehide", () => cancelAnimationFrame(animation));
    window.addEventListener("pageshow", event => {
        if (event.persisted) { last = 0; animation = requestAnimationFrame(frame); }
    });
    animation = requestAnimationFrame(frame);
})();
