// Kart üzerindeki yazıları çalışma anında çizer (örnekteki gömülü maskenin yerine).
// Yerleşim, orijinal maskeyle birebir aynıdır: sol üstte işaret, altta başlık + alt başlık,
// en altta iki küçük mono etiket. Metinleri yalnızca LETTERING_TEXT içinde değiştirin.
export const LETTERING_TEXT = {
  mark: 'OğuzZ',
  title: 'Geliştirici',
  subtitle: 'Web ve mobil uygulamalar.',
  meta: 'NEXT.JS · REACT NATIVE',
  tag: 'WEBGPU',
};

const SANS = '"Space Grotesk", "Inter", system-ui, sans-serif';
const BODY = '"Inter", system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// --- Arka yüz: sayfadaki "Bir fikriniz mi var?" kutusunun içeriği ---
export const BACK_TEXT = {
  label: 'İLETİŞİM',
  heading: ['Bir fikriniz', 'mi var?'],
  body: 'Proje, iş birliği veya sadece merhaba demek için bana yazabilirsiniz.',
  footer: 'OĞUZHAN ŞAMİL AVAN',
};

/** Arka yüzdeki tıklanabilir satırlar. `rect` maske pikselleridir: [x0, y0, x1, y1]. */
export const BACK_LINKS = [
  {
    label: 'E-POSTA', text: 'oguzhanhyla@gmail.com',
    href: 'mailto:oguzhanhyla@gmail.com', external: false,
    aria: 'oguzhanhyla@gmail.com adresine e-posta gönder', rect: [70, 920, 954, 1040],
  },
  {
    label: 'GITHUB', text: 'github.com/OguzZ73/mosaica-showcase',
    href: 'https://github.com/OguzZ73/mosaica-showcase', external: true,
    aria: 'GitHub profilini yeni sekmede aç', rect: [70, 1040, 954, 1160],
  },
];

const FONTS = [
  [`600 64px ${SANS}`, LETTERING_TEXT.mark],
  [`500 66px ${SANS}`, LETTERING_TEXT.title],
  [`400 30px ${BODY}`, LETTERING_TEXT.subtitle],
  [`500 96px ${SANS}`, BACK_TEXT.heading.join(' ')],
  [`400 32px ${BODY}`, BACK_TEXT.body],
  [`500 38px ${SANS}`, BACK_LINKS.map((l) => l.text).join(' ')],
];

/** Sayfa yazı tipleri yüklenene kadar (en fazla ~1,5 sn) bekler; yüklenemezse yedek yazı tipiyle devam eder. */
export function loadLetteringFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loads = Promise.all(FONTS.map(([font, text]) => document.fonts.load(font, text).catch(() => [])));
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  return Promise.race([loads, timeout]).then(() => undefined);
}

function spaced(ctx, text, x, y, spacing, align) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cursor = align === 'right' ? x - total : x;
  chars.forEach((c, i) => { ctx.fillText(c, cursor, y); cursor += widths[i] + spacing; });
}

/** 1 kanallı maske çizer: beyaz = tam kapsama, gri = daha silik yazı. */
export function drawLettering(ctx, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#fff';
  ctx.font = FONTS[0][0];
  ctx.fillText(LETTERING_TEXT.mark, 80, 128);
  ctx.font = FONTS[1][0];
  ctx.fillText(LETTERING_TEXT.title, 80, 1170);

  ctx.fillStyle = 'rgb(158,158,158)';
  ctx.font = FONTS[2][0];
  ctx.fillText(LETTERING_TEXT.subtitle, 81, 1223);

  ctx.fillStyle = 'rgb(176,176,176)';
  ctx.font = `500 24px ${MONO}`;
  spaced(ctx, LETTERING_TEXT.meta, 82, 1360, 6, 'left');
  spaced(ctx, LETTERING_TEXT.tag, 940, 1360, 6, 'right');
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; } else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Arka yüz maskesi: başlık, açıklama ve bağlantı satırları (e-posta, GitHub). */
export function drawBackLettering(ctx, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgb(176,176,176)';
  ctx.font = `500 24px ${MONO}`;
  spaced(ctx, BACK_TEXT.label, 82, 128, 6, 'left');

  ctx.fillStyle = '#fff';
  ctx.font = `500 96px ${SANS}`;
  BACK_TEXT.heading.forEach((line, i) => ctx.fillText(line, 80, 400 + i * 108));

  ctx.fillStyle = 'rgb(170,170,170)';
  ctx.font = `400 32px ${BODY}`;
  wrapLines(ctx, BACK_TEXT.body, 860).forEach((line, i) => ctx.fillText(line, 81, 650 + i * 46));

  BACK_LINKS.forEach((link, i) => {
    const top = link.rect[1];
    ctx.fillStyle = 'rgb(80,80,80)';
    ctx.fillRect(82, top, 860, 2);
    ctx.fillStyle = 'rgb(160,160,160)';
    ctx.font = `500 20px ${MONO}`;
    spaced(ctx, link.label, 82, top + 40, 5, 'left');
    ctx.fillStyle = 'rgb(238,238,238)';
    ctx.font = `500 38px ${SANS}`;
    ctx.fillText(link.text, 82, top + 92);
    ctx.fillStyle = 'rgb(160,160,160)';
    ctx.font = `500 34px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText('↗', 942, top + 92);
    ctx.textAlign = 'left';
    if (i === BACK_LINKS.length - 1) ctx.fillRect(82, link.rect[3], 860, 2);
  });

  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.font = `500 22px ${MONO}`;
  spaced(ctx, BACK_TEXT.footer, 82, 1360, 5, 'left');
}
