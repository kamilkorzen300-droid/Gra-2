const $ = id => document.getElementById(id);

let player = null;
let coins = 0;
let health = 100;
let wave = 1;
let earned = 0;
let enemies = [];
let bullets = [];
let running = false;
let paused = false;
let lastTime = 0;

const canvas = $("canvas");
const ctx = canvas.getContext("2d");

let hero = { x: 0, y: 0, angle: 0, speed: 240 };
let keys = {};
let touchMove = { x: 0, y: 0 };

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem("fps_accounts")) || {};
  } catch {
    return {};
  }
}

function save() {
  const accounts = getAccounts();
  accounts[player] = { coins };
  localStorage.setItem("fps_accounts", JSON.stringify(accounts));
}

function register() {
  const nick = $("nick").value.trim();
  const pass = $("password").value;

  if (nick.length < 3 || pass.length < 4) {
    $("authMessage").textContent = "Nick min. 3 znaki, hasło min. 4 znaki.";
    return;
  }

  const accounts = getAccounts();

  if (accounts[nick]) {
    $("authMessage").textContent = "Ten nick jest już zajęty!";
    return;
  }

  accounts[nick] = { coins: 0, password: pass };
  localStorage.setItem("fps_accounts", JSON.stringify(accounts));

  $("authMessage").textContent = "Konto utworzone! Możesz się zalogować.";
}

function login() {
  const nick = $("nick").value.trim();
  const pass = $("password").value;
  const accounts = getAccounts();

  if (!accounts[nick] || accounts[nick].password !== pass) {
    $("authMessage").textContent = "Nieprawidłowy nick lub hasło!";
    return;
  }

  player = nick;
  coins = accounts[nick].coins || 0;

  $("auth").hidden = true;
  $("menu").hidden = false;
  $("playerName").textContent = player;
  updateCoins();
}

function logout() {
  save();
  player = null;
  $("menu").hidden = true;
  $("auth").hidden = false;
}

function updateCoins() {
  $("coins").textContent = coins;
  $("gameCoins").textContent = coins;
  $("shopCoins").textContent = coins;
}

function openShop() {
  $("menu").hidden = true;
  $("shop").hidden = false;
  updateCoins();
}

function buyWeapon() {
  if (coins < 100) {
    alert("Masz za mało monet!");
    return;
  }

  coins -= 100;
  hero.speed += 20;
  save();
  updateCoins();
  alert("Kupiono ulepszenie!");
}

function backMenu() {
  running = false;
  $("game").hidden = true;
  $("shop").hidden = true;
  $("gameOver").hidden = true;
  $("menu").hidden = false;
  updateCoins();
}

function startGame() {
  $("menu").hidden = true;
  $("gameOver").hidden = true;
  $("game").hidden = false;

  canvas.width = Math.min(window.innerWidth, 900);
  canvas.height = Math.max(300, Math.floor(window.innerHeight * 0.65));

  hero.x = canvas.width / 2;
  hero.y = canvas.height / 2;
  hero.angle = 0;

  health = 100;
  wave = 1;
  earned = 0;
  enemies = [];
  bullets = [];

  running = true;
  paused = false;
  spawnWave();
  updateHUD();

  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function spawnWave() {
  const count = Math.min(3 + wave * 2, 35);

  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);

    let x = side === 0 ? 0 :
            side === 1 ? canvas.width :
            Math.random() * canvas.width;

    let y = side === 2 ? 0 :
            side === 3 ? canvas.height :
            Math.random() * canvas.height;

    enemies.push({
      x, y,
      hp: wave >= 10 && wave % 5 === 0 ? 5 : 2,
      maxHp: wave >= 10 && wave % 5 === 0 ? 5 : 2,
      speed: 35 + wave * 2,
      radius: wave >= 10 && wave % 5 === 0 ? 24 : 15
    });
  }
}

function updateHUD() {
  $("health").textContent = health;
  $("wave").textContent = wave;
  $("gameCoins").textContent = coins;
}

function shoot() {
  if (!running || paused) return;

  bullets.push({
    x: hero.x,
    y: hero.y,
    vx: Math.cos(hero.angle) * 650,
    vy: Math.sin(hero.angle) * 650,
    damage: 1
  });
}

function update(dt) {
  let mx = 0, my = 0;

  if (keys.ArrowLeft || keys.a) mx--;
  if (keys.ArrowRight || keys.d) mx++;
  if (keys.ArrowUp || keys.w) my--;
  if (keys.ArrowDown || keys.s) my++;

  mx += touchMove.x;
  my += touchMove.y;

  const len = Math.hypot(mx, my);

  if (len > 0) {
    mx /= len;
    my /= len;
    hero.x += mx * hero.speed * dt;
    hero.y += my * hero.speed * dt;
    hero.angle = Math.atan2(my, mx);
  }

  hero.x = Math.max(18, Math.min(canvas.width - 18, hero.x));
  hero.y = Math.max(18, Math.min(canvas.height - 18, hero.y));

  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    for (const e of enemies) {
      if (e.hp <= 0) continue;

      if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 5) {
        e.hp -= b.damage;
        b.x = -1000;
        break;
      }
    }
  }

  bullets = bullets.filter(b =>
    b.x >= 0 && b.x <= canvas.width &&
    b.y >= 0 && b.y <= canvas.height
  );

  for (const e of enemies) {
    if (e.hp <= 0) continue;

    const dx = hero.x - e.x;
    const dy = hero.y - e.y;
    const distance = Math.hypot(dx, dy) || 1;

    e.x += dx / distance * e.speed * dt;
    e.y += dy / distance * e.speed * dt;

    if (distance < e.radius + 18) {
      health -= 20 * dt;
    }
  }

  const defeated = enemies.filter(e => e.hp <= 0).length;

  if (defeated > 0) {
    coins += defeated * 15;
    earned += defeated * 15;
    enemies = enemies.filter(e => e.hp > 0);
    save();
    updateCoins();
  }

  if (health <= 0) {
    endGame();
    return;
  }

  if (enemies.length === 0) {
    if (wave >= 50) {
      running = false;
      $("game").hidden = true;
      $("gameOver").hidden = false;
      $("gameOver").querySelector("h1").textContent = "🏆 WYGRAŁEŚ!";
      $("earned").textContent = earned;
      save();
      return;
    }

    wave++;
    spawnWave();
  }

  updateHUD();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#394b35";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#52644c";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (const e of enemies) {
    ctx.fillStyle = "#b42323";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillRect(e.x - 18, e.y - e.radius - 12, 36, 5);

    ctx.fillStyle = "#39df39";
    ctx.fillRect(e.x - 18, e.y - e.radius - 12,
      36 * Math.max(0, e.hp / e.maxHp), 5);
  }

  ctx.fillStyle = "#ffe45c";

  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(hero.x, hero.y);
  ctx.rotate(hero.angle);

  ctx.fillStyle = "#248bff";
  ctx.fillRect(-13, -12, 26, 24);

  ctx.fillStyle = "#171717";
  ctx.fillRect(3, -4, 23, 8);

  ctx.restore();
}

function loop(now) {
  if (!running) return;

  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;

  if (!paused) {
    update(dt);
    draw();
  }

  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  save();

  $("game").hidden = true;
  $("gameOver").hidden = false;
  $("gameOver").querySelector("h1").textContent = "KONIEC GRY";
  $("earned").textContent = earned;
}

function pauseGame() {
  paused = !paused;
}

window.addEventListener("keydown", e => {
  keys[e.key] = true;

  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    shoot();
  }
});

window.addEventListener("keyup", e => {
  keys[e.key] = false;
});

function bindMove(id, x, y) {
  const button = $(id);

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    touchMove = { x, y };
    button.setPointerCapture(e.pointerId);
  });

  const stop = e => {
    e.preventDefault();
    touchMove = { x: 0, y: 0 };
  };

  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
}

bindMove("left", -1, 0);
bindMove("right", 1, 0);
bindMove("up", 0, -1);
bindMove("down", 0, 1);

$("shoot").addEventListener("pointerdown", e => {
  e.preventDefault();
  shoot();
});

canvas.addEventListener("pointerdown", e => {
  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left) * canvas.width / rect.width;
  const y = (e.clientY - rect.top) * canvas.height / rect.height;

  hero.angle = Math.atan2(y - hero.y, x - hero.x);
  shoot();
});
