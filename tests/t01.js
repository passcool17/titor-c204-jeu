// v0.1.1 smoke: bug 1 (lives reset),  load, minigames via hook, jump, exploded card, 0 console errors
// 412×915 and 915×412
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8768/?t=1';
const SHOTS = process.argv.includes('shots');
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) || '/workspace/games3d';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = {};
const FAIL = [];
const ok = (k, cond, v) => { R[k] = v === undefined ? !!cond : v; if (!cond) FAIL.push(k); };

async function open(browser, w, h) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: true, isMobile: w < 600, deviceScaleFactor: 1, locale: 'fr-CA',
  });
  const page = await ctx.newPage();
  const logs = [];
  const httpBad = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) httpBad.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 90000 });
  await sleep(600);
  return { ctx, page, logs, httpBad };
}

const errorsOf = (logs) => logs.filter((l) => /^error:|^PAGEERROR:/i.test(l) || /failed to load/i.test(l));

async function measure(page, ms = 1500) {
  return page.evaluate(async (dur) => {
    const t0 = performance.now();
    let frames = 0;
    await new Promise((resolve) => {
      const step = (now) => {
        frames++;
        if (now - t0 >= dur) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const g = window.__game;
    return {
      fps: +(frames * 1000 / (performance.now() - t0)).toFixed(1),
      calls: g.render.calls,
      tris: g.render.triangles,
      js: g.render.js,
      mode: g.mode,
    };
  }, ms);
}

async function suite(page, tag, w, h, shots) {
  const prefix = tag + '.';
  const g = async (fn) => page.evaluate(fn);

  ok(prefix + 'ready', await g(() => !!__game.ready));
  ok(prefix + 'version', (await g(() => __game.version)) === '0.1.1', await g(() => __game.version));
  const nodes = await g(() => __game.nodes);
  ok(prefix + 'nodes', nodes.includes('housing') && nodes.includes('cesium_clock_1') && nodes.includes('vgl_unit'), nodes.length);
  const clips = await g(() => __game.clips);
  ok(prefix + 'clips.c204', clips.c204.includes('explode') && clips.c204.includes('idle'), clips.c204);
  ok(prefix + 'clips.car', Array.isArray(clips.car), clips.car);

  // Bug 2: soft top hidden, Corvette glass is simple alpha (no transmission)
  const vis = await g(() => {
    const car = __game.car;
    const top = car?.getObjectByName('soft_top');
    const glass = [];
    car?.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if ((m.name || '') === 'Corvette_Glass' || /windshield_glass|door_window/.test(o.name || '')) {
          glass.push({
            name: o.name,
            transparent: !!m.transparent,
            opacity: m.opacity,
            depthWrite: !!m.depthWrite,
            transmission: m.transmission || 0,
            renderOrder: o.renderOrder,
          });
        }
      }
    });
    return { topHidden: top ? top.visible === false : 'missing', glass };
  });
  ok(prefix + 'softTop.hidden', vis.topHidden === true, vis.topHidden);
  ok(prefix + 'glass.alpha', vis.glass.length > 0 && vis.glass.every((g) => g.transparent && g.opacity > 0.2 && g.opacity < 0.6 && g.depthWrite === false && g.transmission === 0), vis.glass);

  // Menu measure
  await g(() => __game.openMenu());
  await sleep(400);
  const mMenu = await measure(page, 1200);
  R[prefix + 'menu'] = mMenu;
  ok(prefix + 'menu.calls', mMenu.calls < 100, mMenu.calls);

  // Exploded + card
  await g(() => __game.openExploded());
  await page.waitForFunction(() => window.__game.mode === 'explode', null, { timeout: 10000 });
  await sleep(500);
  const opened = await g(() => __game.openCard('housing'));
  ok(prefix + 'card.open', opened !== false);
  const cardVisible = await page.evaluate(() => {
    const sh = document.getElementById('sheet');
    const tag = document.getElementById('shTag');
    const title = document.getElementById('shTitle');
    return {
      shown: !sh.classList.contains('hidden'),
      tag: tag.textContent,
      title: title.textContent,
    };
  });
  ok(prefix + 'card.visible', cardVisible.shown && cardVisible.title.length > 0, cardVisible);
  ok(prefix + 'card.tag', /Documenté|Jamais authentifié|Ajout de modèle/.test(cardVisible.tag), cardVisible.tag);
  const mExp = await measure(page, 1200);
  R[prefix + 'explode'] = mExp;
  ok(prefix + 'explode.calls', mExp.calls < 100, mExp.calls);
  if (shots) await page.screenshot({ path: OUT + '/titor-c204-jeu-v011-eclate.png', type: 'png' });
  await g(() => { __game.closeCard(); __game.openMenu(); });

  // Mission: skip to minigames
  await g(() => { __game.animMs = 80; __game.startMission({ skipBrief: true, skipDrive: true }); });
  await page.waitForFunction(() => window.__game.mode === 'minigame', null, { timeout: 10000 });
  ok(prefix + 'mg.start', (await g(() => __game.mode)) === 'minigame');
  ok(prefix + 'mg.idx0', (await g(() => __game.miniIndex)) === 0);

  if (shots) {
    await sleep(300);
    await page.screenshot({ path: OUT + '/titor-c204-jeu-v011-minijeu.png', type: 'png' });
  }
  const mMg = await measure(page, 1000);
  R[prefix + 'minigame'] = mMg;
  ok(prefix + 'minigame.calls', mMg.calls < 100, mMg.calls);

  // Complete 4 minigames via hook
  for (let i = 0; i < 4; i++) {
    const idx = await g(() => __game.miniIndex);
    const md = await g(() => __game.mode);
    ok(prefix + 'mg' + i + '.mode', md === 'minigame' && idx === i, { md, idx });
    await g(() => __game.completeMinigame());
    await sleep(250);
  }
  await page.waitForFunction(() => window.__game.mode === 'jump', null, { timeout: 8000 });
  ok(prefix + 'jump.entered', (await g(() => __game.mode)) === 'jump');
  const mJump = await measure(page, 1000);
  R[prefix + 'jump'] = mJump;
  ok(prefix + 'jump.calls', mJump.calls < 100, mJump.calls);

  await g(() => __game.completeJump());
  await sleep(400);
  const after = await g(() => ({ mode: __game.mode, ibm: __game.ibmGot, level: __game.level, score: __game.score, lives: __game.lives }));
  // result dialog should show, ibmGot true
  ok(prefix + 'jump.success', after.ibm === true && after.score > 0, after);
  const resShown = await page.evaluate(() => !document.getElementById('result').classList.contains('hidden'));
  ok(prefix + 'result.shown', resShown);

  // Drive measure (start next or go drive)
  await g(() => { __game.goMenu(); __game.startDrive(); });
  await sleep(400);
  const mDrive = await measure(page, 1200);
  R[prefix + 'drive'] = mDrive;
  ok(prefix + 'drive.calls', mDrive.calls < 100, mDrive.calls);
  if (shots) await page.screenshot({ path: OUT + '/titor-c204-jeu-v011.png', type: 'png' });

  // Bug 1: game over → Menu → Commencer la mission must reset lives to 3
  await g(() => { __game.resetRun(); __game.startDrive(); __game.startSequence(); });
  await page.waitForFunction(() => window.__game.mode === 'minigame', null, { timeout: 10000 });
  for (let i = 0; i < 3; i++) {
    const resHidden = await page.evaluate(() => document.getElementById('result').classList.contains('hidden'));
    if (!resHidden) {
      await page.click('#bResGo'); // Réessayer
      await sleep(250);
    }
    await g(() => __game.failCurrent());
    await sleep(250);
  }
  const over = await g(() => ({
    lives: __game.lives,
    title: document.getElementById('resTitle').textContent,
    shown: !document.getElementById('result').classList.contains('hidden'),
  }));
  ok(prefix + 'gameover.lives0', over.lives === 0 && over.shown, over);
  await page.click('#bResMenu'); // Menu, not Recommencer
  await page.waitForFunction(() => window.__game.mode === 'menu', null, { timeout: 8000 });
  await sleep(200);
  await page.click('#bMission');
  await page.waitForFunction(() => {
    const b = document.getElementById('briefing');
    return b && !b.classList.contains('hidden');
  }, null, { timeout: 8000 });
  await sleep(150);
  await page.click('#bBriefGo');
  await page.waitForFunction(() => window.__game.mode === 'drive', null, { timeout: 8000 });
  const fresh = await g(() => ({ lives: __game.lives, score: __game.score, level: __game.level, ibm: __game.ibmGot, mode: __game.mode }));
  ok(prefix + 'newRun.lives3', fresh.lives === 3 && fresh.score === 0 && fresh.level === 1 && fresh.ibm === false && fresh.mode === 'drive', fresh);

  // Sources page has links
  await g(() => __game.openSources());
  const srcCount = await page.evaluate(() => document.querySelectorAll('#srcList a[href]').length);
  ok(prefix + 'sources.links', srcCount >= 6, srcCount);

  return { mMenu, mExp, mMg, mJump, mDrive };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--autoplay-policy=user-gesture-required'],
  });

  for (const [w, h, tag, shots] of [
    [412, 915, 'p', SHOTS],
    [915, 412, 'l', false],
  ]) {
    const { ctx, page, logs, httpBad } = await open(browser, w, h);
    try {
      await suite(page, tag, w, h, shots);
    } catch (e) {
      FAIL.push(tag + '.exception:' + e.message);
      R[tag + '.exception'] = String(e);
    }
    const errs = errorsOf(logs);
    ok(tag + '.console', errs.length === 0, errs.slice(0, 8));
    ok(tag + '.http', httpBad.length === 0, httpBad.slice(0, 8));
    R[tag + '.logs.n'] = logs.length;
    await ctx.close();
  }

  await browser.close();
  const out = { ok: FAIL.length === 0, fail: FAIL, results: R };
  console.log(JSON.stringify(out, null, 2));
  process.exit(FAIL.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
