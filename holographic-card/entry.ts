// Siteye özel giriş noktası: örnekteki React bileşeninin (index.tsx) yerine geçer.
// Kart artık sayfa boyunca tek bir sabit (fixed) tuvalde çizilir: hero'da durur, kaydırdıkça
// büyüyüp arka plana geçer ve sayfa sonunda arka yüzüyle iletişim alanına yerleşir.
// WebGPU davranışı ve kaynak temizliği (dispose) örnekteki gibi korunur.
import { createRenderer } from './renderer';
import { loadLetteringFonts } from './lettering-draw.js';

const canvas = document.getElementById('holo-canvas') as HTMLCanvasElement | null;
const note = document.getElementById('holo-note');

function showFallback(message: string) {
  if (canvas) canvas.hidden = true;
  document.documentElement.classList.remove('holo-on');
  if (note) {
    note.textContent = message;
    note.hidden = false;
  }
}

async function start() {
  if (!canvas) return;
  if (!('gpu' in navigator)) {
    showFallback('Bu görsel WebGPU destekleyen bir tarayıcı gerektirir.');
    return;
  }
  // Kart yazıları sayfanın yazı tipleriyle çizilir; önce yüklenmelerini bekle.
  await loadLetteringFonts();
  const renderer = createRenderer(canvas, {
    heroAnchor: document.getElementById('holo-anchor'),
    endAnchor: document.getElementById('holo-end'),
    linksHost: document.getElementById('holo-links'),
  });
  renderer.ready.then(
    // Kart hazır olunca sayfadaki düz iletişim kutusu gizlenir; içeriği kartın arka yüzünde görünür.
    () => { document.documentElement.classList.add('holo-on'); },
    (cause: unknown) => {
      console.error('Holographic card initialization failed:', cause);
      showFallback('Bu görsel WebGPU destekleyen bir tarayıcı gerektirir.');
    },
  );
  // Sayfa kapanırken / bfcache'e girerken GPU kaynaklarını ve dinleyicileri bırak.
  window.addEventListener('pagehide', renderer.dispose, { once: true });
}

void start();
