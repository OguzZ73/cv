import { clock, frameLoop, init, surface, type Gpu } from 'vgpu';
import { BACK_LINKS } from './lettering-draw.js';
import { CARD_ROLL, createScene } from './scene';

/** Sayfadaki yer tutucular: kart bunların konumuna/boyutuna göre yerleşir. */
export interface RendererDom {
  /** Hero'daki boş sütun: kart açılışta burada durur. */
  heroAnchor: HTMLElement | null;
  /** İletişim bölümündeki boş alan: kart sayfa sonunda arka yüzüyle buraya yerleşir. */
  endAnchor: HTMLElement | null;
  /** Arka yüzdeki tıklanabilir satırların (e-posta/GitHub/web) bağlanacağı kap. */
  linksHost: HTMLElement | null;
}

const EYE = 4.5; // shader'daki göz uzaklığı
const MASK_W = 1024;
const MASK_H = 1456;

/** 100×100 px'lik bir kutuyu verilen 4 köşeye (sol-üst, sağ-üst, sağ-alt, sol-alt) oturtan CSS matrix3d. */
function quadTransform(q: number[][]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  const S = 100; // kutunun kenarı (px)
  return `matrix3d(${a / S},${d / S},0,${g / S},${b / S},${e / S},0,${h / S},0,0,1,0,${c},${f},0,1)`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrapPi = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

export function createRenderer(canvas: HTMLCanvasElement, dom: RendererDom) {
  let disposed = false;
  let gpu: Gpu | undefined;
  let removeInput = () => {};

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    removeInput();
    gpu?.dispose();
  };

  const ready = (async () => {
    const context = await init();
    if (disposed) { context.dispose(); return; }
    gpu = context;
    // Tam ekran tuval: pahalı shader'ı yormamak için piksel oranı en fazla 1,5.
    const output = surface(context, canvas, { dpr: [1, 1.5] });
    const shader = createScene(context, output);
    await shader.compile({ colors: [output.format] });
    if (disposed) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Arka yüzdeki bağlantılar: kart yerine oturunca üzerine görünmez, gerçek <a> öğeleri biner.
    const links = BACK_LINKS.map((link: (typeof BACK_LINKS)[number]) => {
      const a = document.createElement('a');
      a.className = 'holo-link';
      a.href = link.href;
      a.textContent = `${link.label}: ${link.text}`;
      a.setAttribute('aria-label', link.aria);
      if (link.external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      dom.linksHost?.appendChild(a);
      return { link, el: a };
    });

    const unsubscribeResize = output.onResize(() => {
      shader.set({ params: { resolution: output.size } });
    });
    removeInput = () => {
      unsubscribeResize();
      for (const { el } of links) el.remove();
    };

    // Yumuşatılmış durum
    let aS = -1; // hero → arka plan geçişi (0..1)
    let eS = -1; // arka plan → sayfa sonu konumu (0..1)
    let fS = -1; // arka yüze dönüş (0..1): yalnızca sayfanın sonuna yaklaşınca
    let lightX = 0.2;
    let lightY = -0.25;
    let hover = 0;

    const startedAt = performance.now();
    const time = clock(context);
    frameLoop(context, (currentFrame) => {
      const seconds = (performance.now() - startedAt) / 1000;
      const dt = Math.min(time.deltaTime, 0.1);
      const still = motion.matches;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const scale = Math.min(H, W * 1.35); // shader'daki `scale` ile aynı
      const pxPerUnit = scale / 2.5;

      // --- Yer tutucuların güncel konumları ---
      const hr = dom.heroAnchor?.getBoundingClientRect();
      const er = dom.endAnchor?.getBoundingClientRect();
      const heroW = hr && hr.width > 0 ? hr.width : W * 0.45;
      const heroH = hr && hr.height > 0 ? hr.height : H * 0.6;
      const heroX = hr && hr.width > 0 ? hr.left + hr.width / 2 : W * 0.72;
      const heroY = hr && hr.height > 0 ? hr.top + hr.height / 2 : H * 0.5;
      const mobile = W < 760;

      // --- Geçiş ağırlıkları (kaydırmaya bağlı) ---
      const aT = smooth(clamp(window.scrollY / (H * 0.85), 0, 1));
      const eT = er && er.height > 0 ? smooth(clamp((H * 1.05 - er.top) / (H * 0.85), 0, 1)) : 0;
      const k = still || aS < 0 ? 1 : 1 - Math.exp(-9 * dt);
      // Arka yüze dönüş: sayfanın sonuna ~1,0 ekran kala başlar, ~0,2 ekran kala biter.
      const remaining = Math.max(1, document.documentElement.scrollHeight - H) - window.scrollY;
      const fT = er && er.height > 0 ? smooth(clamp((H * 0.95 - remaining) / (H * 0.75), 0, 1)) : 0;
      aS = aS < 0 ? aT : aS + (aT - aS) * k;
      eS = eS < 0 ? eT : eS + (eT - eS) * k;
      fS = fS < 0 ? fT : fS + (fT - fS) * k;
      const flip = fS * eS;

      // --- Konum, büyüklük, saydamlık ---
      // hero: kart, yer tutucuya sığar. arka plan: ekrandan büyük ve soluk. son: iletişim alanı.
      const zoomHero = Math.min(heroH, heroW * 1.35) / scale;
      const zoomBg = (H * 1.25) / (0.728 * scale);
      const zoomEnd = er && er.height > 0 ? (Math.min(er.height, er.width * 1.35) * 0.98) / scale : zoomBg;
      const logZoom = lerp(lerp(Math.log(zoomHero), Math.log(zoomBg), aS), Math.log(zoomEnd), eS);
      const zoom = Math.exp(logZoom);

      const bgX = mobile ? W * 0.5 : W * 0.68;
      const bgY = H * 0.5;
      const endX = er && er.width > 0 ? er.left + er.width / 2 : bgX;
      const endY = er && er.height > 0 ? er.top + er.height / 2 : bgY;
      const centerPxX = lerp(lerp(heroX, bgX, aS), endX, eS);
      const centerPxY = lerp(lerp(heroY, bgY, aS), endY, eS);
      const centerX = (centerPxX - W / 2) / pxPerUnit;
      const centerY = (centerPxY - H / 2) / pxPerUnit;
      const fade = lerp(lerp(1, mobile ? 0.3 : 0.38, aS), 1, eS);

      // --- Dönüş ---
      // Hero'da da arka planda da aynı hafif sağa sola salınım (tam tur yok): kartın arka yüzü
      // sayfanın sonuna kadar görünmez. Sona yaklaşınca yavaşça arka yüze döner ve 3/4 duruşa yerleşir.
      const sway = still ? 0 : Math.sin(seconds * 0.55) * 0.34;
      // Tur kaydırmaya bağlı: sayfanın başından aşağı kaydırdıkça kart etrafında bir tam tur atar
      // ve aynı anda büyüyüp arka plana geçer (`aS` ile aynı ilerleme). Yukarı kaydırınca geri döner.
      const turn = aS;
      const yawFront = sway + Math.PI * 2 * turn;
      const yawEnd = Math.PI - 0.5 + (still ? 0 : Math.sin(seconds * 0.5) * 0.08);
      const yaw = yawFront + wrapPi(yawEnd - yawFront) * flip;
      const pitch = (still ? 0 : Math.sin(seconds * 0.4 + 1) * 0.06) * (1 - 0.5 * flip);
      // Eğim, turla birlikte diğer tarafa geçer (+CARD_ROLL → -CARD_ROLL); sayfa sonunda kendini toparlar.
      const rollBase = lerp(CARD_ROLL, -CARD_ROLL, turn);
      const roll = lerp(rollBase, -0.1, flip);

      // --- Işık: kartın dönüşüne bağlı süpürme ---
      const targetLightX = still ? 0.2 : Math.sin(seconds * 0.55 + 0.9) * 1.15;
      const targetLightY = still ? -0.25 : -0.15 + Math.sin(seconds * 0.37 + 0.4) * 0.55;
      const blend = still ? 1 : 1 - Math.exp(-10 * dt);
      lightX += (targetLightX - lightX) * blend;
      lightY += (targetLightY - lightY) * blend;
      hover += (1 - hover) * blend;

      shader.set({
        params: {
          tilt: [yaw, pitch], pointer: [lightX, lightY], center: [centerX, centerY],
          hover, roll, zoom, fade,
        },
      });
      currentFrame.pass(output, shader);

      // --- Arka yüzdeki bağlantıları kartın ekrandaki konumuna oturt ---
      if (dom.linksHost) {
        const settled = flip > 0.97;
        dom.linksHost.hidden = !settled;
        if (settled) {
          const sx = Math.sin(pitch), cx = Math.cos(pitch);
          const sy = Math.sin(yaw), cy = Math.cos(yaw);
          const sr = Math.sin(roll), cr = Math.cos(roll);
          const axisX = [cy, 0, -sy];
          const axisY = [sy * sx, cx, cy * sx];
          const right = axisX.map((v, i) => v * cr + axisY[i] * sr);
          const down = axisY.map((v, i) => v * cr - axisX[i] * sr);
          // Maske pikseli → CSS pikseli (shader'ın tersi: aynalı p, perspektif, zoom, merkez)
          const project = (mx: number, my: number) => {
            const px = -((mx / MASK_W - 0.5) * 1.28);
            const py = (my / MASK_H - 0.5) * 1.82;
            const hx = px * right[0] + py * down[0];
            const hy = px * right[1] + py * down[1];
            const hz = px * right[2] + py * down[2];
            const persp = EYE / (EYE - hz);
            return [
              W / 2 + (hx * persp * zoom + centerX) * pxPerUnit,
              H / 2 + (hy * persp * zoom + centerY) * pxPerUnit,
            ];
          };
          // Her satırın dörtgenini (perspektifli) tam olarak kaplayan dönüşüm: komşu satırlarla
          // üst üste binmez, tıklama yalnızca görünen satırın üzerinde çalışır.
          for (const { link, el } of links) {
            const [x0, y0, x1, y1] = link.rect;
            const q = [project(x0, y0), project(x1, y0), project(x1, y1), project(x0, y1)];
            el.style.transform = quadTransform(q);
          }
        }
      }
    }, { fps: 60 });
  })().catch((error: unknown) => {
    if (disposed) return;
    dispose();
    throw error;
  });

  return { ready, dispose };
}
