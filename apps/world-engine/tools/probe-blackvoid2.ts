/**
 * probe-blackvoid2.ts — raycast attribution for the "gate black void".
 *
 * Boots the failing framing and raycasts from the camera through a set of
 * screen pixels (black-band members + references), reporting every hit's
 * object identity, world point, and distance, plus scene facts (plateau Y,
 * sun direction, camera pose, glory sphere position).
 *
 * Usage: npx tsx tools/probe-blackvoid2.ts
 */

import { launchWebGPU, laasUrl } from './launch';

const CAM = '-1000,940,2180,0,-0.2,70';

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  const url = laasUrl({ scene: 'newjerusalem', width: 1280, height: 800, cam: CAM, hud: false, freeze: true });
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    'window.__laas && (window.__laas.ready || window.__laas.error !== null)',
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);
  await page.evaluate('window.__laas.settle ? window.__laas.settle(8) : 0');

  const facts = await page.evaluate(`(async () => {
    const dbg = window.__laasDbg;
    const engine = dbg.engine;
    const scene = engine.scene;
    const camera = engine.camera;
    const allot = scene.getObjectByName('holy-allotment');
    const city = scene.getObjectByName('new-jerusalem');

    // Grab THREE from the city mesh's constructor chain: use any mesh's raycast
    // machinery via a Raycaster obtained from the module graph. Simplest: the
    // engine bundle exposes no THREE, so build a raycaster from camera's
    // constructor namespace is impossible — instead use camera.getWorldDirection
    // math and object.raycast via a hand-rolled Raycaster substitute is heavy.
    // Cheat: import three from the Vite dev server's module cache.
    const three = await import('/node_modules/.vite/deps/three.js').catch(() => null)
      || await import('three').catch(() => null);
    if (!three) return { error: 'cannot import three in page' };
    const { Raycaster, Vector2, Vector3 } = three;

    const px = [
      [640, 300, 'black-center'],
      [300, 300, 'black-left'],
      [1000, 300, 'black-right'],
      [640, 430, 'black-bottom'],
      [640, 200, 'black-upper'],
      [820, 30, 'top-black-arc'],
      [640, 120, 'gold-above-black'],
      [640, 600, 'grass-below'],
    ];
    const out = { hits: [], cam: camera.position.toArray(), allotY: allot.position.y, allotScale: allot.scale.x };
    const ray = new Raycaster();
    ray.far = 100000;
    for (const [x, y, tag] of px) {
      const ndc = new Vector2((x / 1280) * 2 - 1, -((y / 800) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true).slice(0, 4).map((h) => {
        const chain = [];
        for (let p = h.object; p; p = p.parent) chain.unshift(p.name || p.type);
        const mats = Array.isArray(h.object.material) ? h.object.material : [h.object.material];
        return {
          d: Math.round(h.distance),
          at: h.point.toArray().map((v) => Math.round(v)),
          geo: h.object.geometry.type,
          params: h.object.geometry.parameters ? JSON.stringify(h.object.geometry.parameters).slice(0, 120) : null,
          chain: chain.join('>'),
          mat: mats.map((m) => (m ? m.type + ' color=#' + (m.color ? m.color.getHexString() : '?') + ' emiss=#' + (m.emissive ? m.emissive.getHexString() : '?') + 'x' + m.emissiveIntensity : 'null')),
        };
      });
      out.hits.push({ tag, x, y, hits });
    }

    // Sun facts if exposed.
    const sunSky = dbg.sunSky;
    if (sunSky && sunSky.sunDir) out.sunDir = sunSky.sunDir.value ? sunSky.sunDir.value.toArray() : String(sunSky.sunDir);
    if (sunSky && sunSky.sun && sunSky.sun.position) out.sunPos = sunSky.sun.position.toArray();
    // glory sphere = last child of city (added last in buildCityMassing)
    const glory = city.children[city.children.length - 1];
    out.glory = { pos: glory.getWorldPosition(new Vector3()).toArray().map((v) => Math.round(v)), geo: glory.geometry.type };
    return out;
  })()`);
  console.log(JSON.stringify(facts, null, 2));

  await browser.close();
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
