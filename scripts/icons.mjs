// Gera logo otimizada e favicons a partir do arquivo da logo em assets/brand/.
// Usa o arquivo mais recente chamado logo.* (png, jpg, webp ou svg). Se você colocar
// sua logo em PNG (ex.: assets/brand/logo.png), ela passa a ser usada no lugar da provisória.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'assets/brand');
const BG = '#0a0908';

export async function findLogo() {
  const files = await fs.readdir(BRAND);
  const cands = [];
  for (const f of files) {
    if (!/^logo\.(png|jpe?g|webp|svg)$/i.test(f)) continue;
    const st = await fs.stat(path.join(BRAND, f));
    // a provisória (logo.svg) só vale se não houver outra
    cands.push({ f, t: st.mtimeMs, svg: /\.svg$/i.test(f) });
  }
  cands.sort((a, b) => (a.svg - b.svg) || (b.t - a.t));
  if (!cands.length) throw new Error('Nenhuma logo encontrada em assets/brand (esperado logo.png, logo.jpg, logo.webp ou logo.svg).');
  return path.join(BRAND, cands[0].f);
}

async function square(src, size, { round = true, pad = 0 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = await sharp(src, { density: 600 })
    .resize(inner, inner, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .toBuffer();
  let out = sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: img, gravity: 'center' }]);
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    out = sharp(await out.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  return out;
}

export async function buildIcons() {
  const src = await findLogo();
  const rel = path.relative(ROOT, src);
  const w = (n) => path.join(BRAND, n);
  // logo exibida no topo da página (recorte circular, fundo transparente)
  for (const s of [192, 384]) {
    await (await square(src, s)).webp({ quality: 90 }).toFile(w(`logo-${s}.webp`));
  }
  await (await square(src, 512)).png().toFile(w('logo-512.png'));
  // favicons
  await (await square(src, 32)).png().toFile(w('favicon-32.png'));
  await (await square(src, 180, { round: false, pad: 0.06 })).png().toFile(w('apple-touch-icon.png'));
  await (await square(src, 192, { round: false, pad: 0.1 })).png().toFile(w('icon-192.png'));
  await (await square(src, 512, { round: false, pad: 0.1 })).png().toFile(w('icon-512.png'));
  if (/\.svg$/i.test(src)) await fs.copyFile(src, w('favicon.svg'));
  else {
    // favicon.svg com a imagem embutida, para navegadores que preferem SVG
    const b64 = (await (await square(src, 64)).png().toBuffer()).toString('base64');
    await fs.writeFile(w('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${b64}"/></svg>\n`);
  }
  console.log(`✓ Ícones gerados a partir de ${rel}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildIcons().catch((e) => { console.error(e.message); process.exit(1); });
}
