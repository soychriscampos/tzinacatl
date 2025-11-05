const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heartsEl = document.getElementById("hearts");
const restartBtn = document.getElementById("restart");

const heroImage = new Image();
heroImage.src = "chinacate.png";

const tomahawkImage = new Image();
tomahawkImage.src = "tomahawk.png";

const beerImage = new Image();
beerImage.src = "beer.png";

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const INITIAL_HEARTS = 5;
const OBSTACLE_INTERVAL = 1500;
const PICKUP_INTERVAL = 6000;
const BASE_OBSTACLE_SPEED = 190;
const GRAVITY = 1200;
const FLAP_STRENGTH = -360;
const HERO_SIZE = 56;
const HIT_COOLDOWN = 900;
const PICKUP_SIZE = 42;
const GAP_SIZE = 200;
const GAP_MARGIN = 90;
const RUNWAY_HEIGHT = 120;
const GROUND_LEVEL = GAME_HEIGHT - RUNWAY_HEIGHT;
const SPEED_STEP_THRESHOLD = 10;
const SPEED_INCREMENT = 1 / 6;
const INPUT_COOLDOWN_MS = 80;
const CYCLE_POINTS = 90;
const HALF_CYCLE = CYCLE_POINTS / 2;
const STAR_POSITIONS = [
  { x: 60, y: 90, radius: 1.8 },
  { x: 130, y: 60, radius: 1.4 },
  { x: 210, y: 70, radius: 1.7 },
  { x: 310, y: 40, radius: 1.6 },
  { x: 360, y: 110, radius: 1.2 },
  { x: 260, y: 130, radius: 1.5 },
];

let previousTime = 0;
let lastInputAt = -Infinity;

const state = {
  running: false,
  hearts: INITIAL_HEARTS,
  score: 0,
  hero: {
    x: GAME_WIDTH * 0.22,
    y: GAME_HEIGHT / 2,
    vy: 0,
    rotation: 0,
  },
  obstacles: [],
  pickups: [],
  obstacleCount: 0,
  lastObstacleAt: 0,
  lastPickupAt: 0,
  lastHitAt: -Infinity,
};

function resetGame() {
  state.running = false;
  state.hearts = INITIAL_HEARTS;
  state.score = 0;
  state.hero.x = GAME_WIDTH * 0.22;
  state.hero.y = GAME_HEIGHT / 2;
  state.hero.vy = 0;
  state.hero.rotation = 0;
  state.obstacles = [];
  state.pickups = [];
  state.obstacleCount = 0;
  const now = performance.now();
  state.lastObstacleAt = now;
  state.lastPickupAt = now;
  state.lastHitAt = -Infinity;
  previousTime = now;
  lastInputAt = -Infinity;
  updateHUD();
}

function startGame() {
  if (!state.running) {
    state.running = true;
    previousTime = performance.now();
  }
}

function updateHUD() {
  const clampedHearts = Math.max(0, Math.min(state.hearts, INITIAL_HEARTS));
  const filled = "❤️".repeat(clampedHearts);
  const empty = "🤍".repeat(Math.max(0, INITIAL_HEARTS - clampedHearts));
  heartsEl.textContent = filled + empty;
}

function flap() {
  startGame();
  state.hero.vy = FLAP_STRENGTH;
}

function spawnObstacle(currentTime) {
  state.obstacleCount += 1;
  const isTightColumn = state.obstacleCount % 10 === 0;
  const gapSize = isTightColumn ? Math.max(140, GAP_SIZE - 60) : GAP_SIZE;
  const minGapY = GAP_MARGIN;
  const maxGapY = GAME_HEIGHT - GAP_MARGIN - gapSize;
  const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
  const width = 80;

  state.obstacles.push({
    x: GAME_WIDTH,
    width,
    gapY,
    gapSize,
    passed: false,
  });

  state.lastObstacleAt = currentTime;
}

function spawnPickup(currentTime) {
  const type = Math.random() < 0.5 ? "tomahawk" : "cerveza";
  const radius = PICKUP_SIZE / 2;
  const y = Math.random() * (GROUND_LEVEL - 160) + 80;

  state.pickups.push({
    x: GAME_WIDTH + 40,
    y,
    radius,
    type,
  });

  state.lastPickupAt = currentTime;
}

function intersectsRect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function intersectsCircleRect(cx, cy, cr, rx, ry, rw, rh) {
  // Clamp circle center to rectangle bounds to get closest point
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function handleObstacleCollision(obstacle, elapsed) {
  const now = performance.now();
  if (now - state.lastHitAt < HIT_COOLDOWN) {
    return;
  }
  state.hearts = Math.max(0, state.hearts - 1);
  state.lastHitAt = now;
  updateHUD();
  if (state.hearts === 0) {
    resetGame();
    return;
  }
}

function handlePickupCollision(pickup) {
  if (state.hearts < INITIAL_HEARTS) {
    state.hearts += 1;
    updateHUD();
  }
}

function update(dt, elapsed) {
  const hero = state.hero;
  const speed = getCurrentSpeed();
  hero.vy += GRAVITY * dt;
  hero.y += hero.vy * dt;
  hero.rotation = Math.max(-0.35, Math.min(0.45, hero.vy / 600));

  if (hero.y < 0) {
    hero.y = 0;
    hero.vy = 0;
  } else if (hero.y + HERO_SIZE > GROUND_LEVEL) {
    hero.y = GROUND_LEVEL - HERO_SIZE;
    hero.vy = -Math.abs(FLAP_STRENGTH) * 2;
    hero.rotation = -0.2;
  }

  if (elapsed - state.lastObstacleAt > OBSTACLE_INTERVAL) {
    spawnObstacle(elapsed);
  }

  if (elapsed - state.lastPickupAt > PICKUP_INTERVAL) {
    if (Math.random() < 0.75) {
      spawnPickup(elapsed);
    } else {
      state.lastPickupAt = elapsed;
    }
  }

  state.obstacles.forEach((obstacle) => {
    obstacle.x -= speed * dt;
    const topRect = { x: obstacle.x, y: 0, width: obstacle.width, height: obstacle.gapY };
    const bottomRect = {
      x: obstacle.x,
      y: obstacle.gapY + obstacle.gapSize,
      width: obstacle.width,
      height: Math.max(0, GROUND_LEVEL - (obstacle.gapY + obstacle.gapSize)),
    };

    if (
      intersectsRect(hero.x, hero.y, HERO_SIZE * 0.7, HERO_SIZE * 0.85, topRect.x, topRect.y, topRect.width, topRect.height) ||
      intersectsRect(hero.x, hero.y, HERO_SIZE * 0.7, HERO_SIZE * 0.85, bottomRect.x, bottomRect.y, bottomRect.width, bottomRect.height)
    ) {
      handleObstacleCollision(obstacle, elapsed);
      if (!state.running) {
        return;
      }
    }

    if (!obstacle.passed && obstacle.x + obstacle.width < hero.x) {
      obstacle.passed = true;
      state.score += 1;
      updateHUD();
    }
  });

  if (!state.running) {
    return;
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);

  state.pickups.forEach((pickup) => {
    pickup.x -= speed * 0.85 * dt;
    if (intersectsCircleRect(pickup.x, pickup.y, pickup.radius, hero.x, hero.y, HERO_SIZE * 0.7, HERO_SIZE * 0.85)) {
      handlePickupCollision(pickup);
      pickup.collected = true;
    }
  });

  state.pickups = state.pickups.filter((pickup) => !pickup.collected && pickup.x + pickup.radius > -10);
}

function getCurrentSpeed() {
  const difficultySteps = Math.floor(state.score / SPEED_STEP_THRESHOLD);
  return BASE_OBSTACLE_SPEED * (1 + difficultySteps * SPEED_INCREMENT);
}

function getDayNightFactor() {
  if (state.score <= 0) {
    return 0;
  }
  const position = state.score % CYCLE_POINTS;
  if (position <= HALF_CYCLE) {
    return clamp(position / HALF_CYCLE, 0, 1);
  }
  return clamp(1 - (position - HALF_CYCLE) / HALF_CYCLE, 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(colorA, colorB, t) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const sanitized = hex.replace("#", "");
  const value = sanitized.length === 3 ? sanitized.split("").map((c) => c + c).join("") : sanitized;
  const bigint = parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function drawHero(hero) {
  const frameWidth = HERO_SIZE;
  const frameHeight = HERO_SIZE;

  ctx.save();
  ctx.translate(hero.x + frameWidth / 2, hero.y + frameHeight / 2);
  ctx.rotate(hero.rotation);
  ctx.drawImage(heroImage, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
  ctx.restore();
}

function drawObstacles() {
  state.obstacles.forEach((obstacle) => {
    const topHeight = obstacle.gapY;
    const bottomY = obstacle.gapY + obstacle.gapSize;
    const bottomHeight = Math.max(0, GROUND_LEVEL - bottomY);

    if (topHeight > 0) {
      drawSignalColumn(obstacle.x, 0, obstacle.width, topHeight, true);
    }

    if (bottomHeight > 0) {
      drawSignalColumn(obstacle.x, bottomY, obstacle.width, bottomHeight, false);
    }
  });
}

function drawSignalColumn(x, y, width, height, fromTop) {
  ctx.save();

  // Base column
  const bodyColor = ctx.createLinearGradient(x, y, x + width, y);
  bodyColor.addColorStop(0, "#ffab40");
  bodyColor.addColorStop(0.5, "#fff3e0");
  bodyColor.addColorStop(1, "#ffab40");

  ctx.fillStyle = "#eceff1";
  ctx.fillRect(x, y, width, height);

  // Stripes
  ctx.fillStyle = "#ff6f00";
  let stripeY = fromTop ? y : y + 16;
  const stripeHeight = 24;
  while (stripeY < y + height) {
    const segmentHeight = Math.min(stripeHeight, y + height - stripeY);
    ctx.fillRect(x, stripeY, width, segmentHeight / 2);
    stripeY += stripeHeight;
  }

  // Orange accent gradient overlay
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1;

  // Caps and base
  ctx.fillStyle = fromTop ? "#455a64" : "#37474f";
  const capHeight = Math.min(20, height * 0.18);
  if (fromTop) {
    ctx.fillRect(x - 4, y + height - capHeight, width + 8, capHeight);
  } else {
    ctx.fillRect(x - 4, y, width + 8, capHeight);
    ctx.fillStyle = "#263238";
    ctx.fillRect(x - 6, y + height - 12, width + 12, 12);
  }

  // Edge highlight
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  ctx.restore();
}

function drawPickups() {
  state.pickups.forEach((pickup) => {
    const image = pickup.type === "tomahawk" ? tomahawkImage : beerImage;
    const maxSize = PICKUP_SIZE;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    if (image.complete && image.naturalWidth > 0) {
      const aspect = image.naturalWidth / image.naturalHeight || 1;
      let drawWidth = maxSize * aspect;
      let drawHeight = maxSize;
      if (drawWidth > maxSize) {
        drawWidth = maxSize;
        drawHeight = drawWidth / aspect;
      }
      if (drawHeight > maxSize) {
        drawHeight = maxSize;
        drawWidth = drawHeight * aspect;
      }
      const x = pickup.x - drawWidth / 2;
      const y = pickup.y - drawHeight / 2;
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    } else {
      ctx.beginPath();
      ctx.fillStyle = pickup.type === "tomahawk" ? "#ef5350" : "#ffeb3b";
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawScore() {
  const padding = 14;
  const boxWidth = 156;
  const boxHeight = 66;
  const x = GAME_WIDTH - boxWidth - padding;
  const y = padding;
  const factor = getDayNightFactor();

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = factor > 0.5 ? "rgba(8, 10, 18, 0.75)" : "rgba(14, 18, 26, 0.55)";
  drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 12);
  ctx.fill();

  ctx.strokeStyle = factor > 0.5 ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f5f7ff";
  ctx.textBaseline = "top";

  ctx.font = "500 13px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PTS", x + 14, y + 10);

  ctx.font = "600 20px 'Segoe UI', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${state.score}`, x + boxWidth - 14, y + 8);

  const currentHearts = clamp(state.hearts, 0, INITIAL_HEARTS);
  const filledHearts = "❤️".repeat(currentHearts);
  const emptyHearts = "🤍".repeat(INITIAL_HEARTS - currentHearts);

  ctx.font = "500 17px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${filledHearts}${emptyHearts}`, x + boxWidth / 2, y + boxHeight - 28);

  ctx.restore();
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawRunway() {
  const runwayHeight = RUNWAY_HEIGHT;
  const runwayY = GROUND_LEVEL;

  // Apron before runway
  ctx.fillStyle = "#546169";
  ctx.fillRect(0, runwayY - 28, GAME_WIDTH, 28);

  // Runway body
  ctx.fillStyle = "#2f3339";
  ctx.fillRect(0, runwayY, GAME_WIDTH, runwayHeight);

  // Runway edge lines
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, runwayY + 12, GAME_WIDTH, 4);
  ctx.fillRect(0, runwayY + runwayHeight - 16, GAME_WIDTH, 4);

  // Center dashed line
  const dashWidth = 20;
  const dashGap = 32;
  const centerY = runwayY + runwayHeight / 2 - 3;
  for (let x = 20; x < GAME_WIDTH - dashWidth; x += dashWidth + dashGap) {
    ctx.fillRect(x, centerY, dashWidth, 6);
  }

  // Taxi lines
  ctx.fillStyle = "#ffca28";
  ctx.fillRect(0, runwayY + 40, GAME_WIDTH, 3);
  ctx.fillRect(0, runwayY + runwayHeight - 40, GAME_WIDTH, 3);
}

function drawOverlay() {
  if (!state.running) {
    ctx.fillStyle = "rgba(13, 17, 23, 0.6)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.hearts === 0 ? "Fin del vuelo" : "Listo para volar", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36);
    ctx.font = "18px 'Segoe UI', sans-serif";
    const instruction =
      state.hearts === 0 ? "Toca Reiniciar o la pantalla para intentarlo de nuevo" : "Toca o haz clic para despegar";
    ctx.fillText(instruction, GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
}

function drawBackground() {
  const factor = getDayNightFactor();
  const skyHeight = GAME_HEIGHT * 0.65;
  const daySky = ["#9cd4ff", "#5f9ce3", "#d7ecff"];
  const nightSky = ["#040915", "#06101f", "#070b12"];
  const skyGradient = ctx.createLinearGradient(0, 0, 0, skyHeight);
  [0, 0.6, 1].forEach((stop, index) => {
    skyGradient.addColorStop(stop, mixColor(daySky[index], nightSky[index], factor));
  });

  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Sun glow
  const sunAlpha = clamp(1 - factor * 1.15, 0, 1);
  if (sunAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = sunAlpha;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 245, 157, 0.75)";
    ctx.arc(GAME_WIDTH - 70, 82, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Moon glow
  const moonAlpha = clamp((factor - 0.15) * 1.25, 0, 1);
  if (moonAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = moonAlpha;
    const moonX = GAME_WIDTH - 110;
    const moonY = 94;
    ctx.beginPath();
    ctx.fillStyle = "rgba(230, 236, 255, 0.92)";
    ctx.arc(moonX, moonY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = "rgba(140, 150, 190, 0.55)";
    ctx.beginPath();
    ctx.arc(moonX - 12, moonY - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + 10, moonY + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Stars
  const starIntensity = clamp(factor - 0.25, 0, 1);
  if (starIntensity > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * starIntensity})`;
    STAR_POSITIONS.forEach((star) => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Horizon haze
  const hazeGradient = ctx.createLinearGradient(0, skyHeight - 40, 0, skyHeight + 80);
  const hazeTop = `rgba(${Math.round(lerp(255, 55, factor))}, ${Math.round(lerp(255, 90, factor))}, ${Math.round(
    lerp(255, 160, factor)
  )}, ${lerp(0.55, 0.28, factor).toFixed(2)})`;
  const hazeBottom = `rgba(${Math.round(lerp(180, 20, factor))}, ${Math.round(lerp(200, 45, factor))}, ${Math.round(
    lerp(215, 80, factor)
  )}, ${lerp(0.0, 0.18, factor).toFixed(2)})`;
  hazeGradient.addColorStop(0, hazeTop);
  hazeGradient.addColorStop(1, hazeBottom);
  ctx.fillStyle = hazeGradient;
  ctx.fillRect(0, skyHeight - 60, GAME_WIDTH, 140);

  // Terminal building
  const terminalY = skyHeight - 50;
  const terminalHeight = 70;
  ctx.fillStyle = mixColor("#cfd8dc", "#2b3445", factor);
  ctx.fillRect(20, terminalY, GAME_WIDTH - 40, terminalHeight);
  ctx.fillStyle = mixColor("#b0bec5", "#1a202f", factor);
  ctx.fillRect(20, terminalY, GAME_WIDTH - 40, 18);

  // Terminal windows
  ctx.fillStyle = factor > 0.2 ? "rgba(255, 173, 23, 0.8)" : "rgba(55, 71, 79, 0.7)";
  for (let x = 40; x < GAME_WIDTH - 40; x += 34) {
    ctx.fillRect(x, terminalY + 24, 24, 20);
  }

  // Control tower
  const towerBaseX = GAME_WIDTH - 120;
  const towerBaseY = terminalY - 80;
  ctx.fillStyle = mixColor("#c1d0d6", "#374155", factor);
  ctx.fillRect(towerBaseX, towerBaseY, 28, 80);
  ctx.fillStyle = mixColor("#90a4ae", "#1b2334", factor);
  ctx.fillRect(towerBaseX - 8, towerBaseY - 40, 44, 40);
  ctx.fillStyle = mixColor("#eceff1", "#232c3f", factor);
  ctx.fillRect(towerBaseX - 2, towerBaseY - 52, 32, 12);
  ctx.save();
  ctx.globalAlpha = clamp(1 - factor * 0.9, 0, 1);
  ctx.beginPath();
  ctx.fillStyle = "#ffab40";
  ctx.arc(towerBaseX + 14, towerBaseY - 56, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Taxiing aircraft silhouettes
  ctx.fillStyle = factor > 0.4 ? "rgba(30, 38, 56, 0.85)" : "rgba(80, 101, 115, 0.55)";
  ctx.fillRect(70, terminalY + terminalHeight - 16, 90, 12);
  ctx.fillRect(160, terminalY + terminalHeight - 24, 70, 10);
  ctx.beginPath();
  ctx.ellipse(110, terminalY + terminalHeight - 24, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (factor > 0.6) {
    ctx.save();
    ctx.globalAlpha = (factor - 0.6) * 0.5;
    ctx.fillStyle = "rgba(15, 16, 24, 0.6)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
  }
}

function loop(timestamp) {
  const elapsed = timestamp;
  const dt = (timestamp - previousTime) / 1000;
  previousTime = timestamp;

  drawBackground();

  if (state.running) {
    update(dt, elapsed);
  }

  drawObstacles();
  drawPickups();
  drawHero(state.hero);
  drawRunway();
  drawOverlay();
  drawScore();

  requestAnimationFrame(loop);
}

function handlePointerStart(event) {
  event.preventDefault();
  const now = performance.now();
  if (now - lastInputAt < INPUT_COOLDOWN_MS) {
    return;
  }
  lastInputAt = now;
  flap();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    flap();
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    resetGame();
    startGame();
  }
});

canvas.addEventListener("pointerdown", handlePointerStart, { passive: false });
canvas.addEventListener("touchstart", handlePointerStart, { passive: false });
restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

heroImage.addEventListener("load", () => {
  resetGame();
  requestAnimationFrame((time) => {
    previousTime = time;
    loop(time);
  });
});

updateHUD();
