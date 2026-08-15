/**
 * Lectura ligera de width/height desde cabeceras de imagen (sin descargar el archivo completo).
 */

const PROBE_BYTES = 65536;
const PROBE_TIMEOUT_MS = 4000;

/**
 * @param {Uint8Array} buf
 * @returns {{ width: number, height: number, type?: string } | null}
 */
export function readImageSizeFromBuffer(buf) {
  if (!buf || buf.length < 24) return null;

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a &&
    buf.length >= 24
  ) {
    const width = readUInt32BE(buf, 16);
    const height = readUInt32BE(buf, 20);
    if (width > 0 && height > 0) return { width, height, type: 'png' };
  }

  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf.length >= 10) {
    const width = buf[6] | (buf[7] << 8);
    const height = buf[8] | (buf[9] << 8);
    if (width > 0 && height > 0) return { width, height, type: 'gif' };
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (len < 2) break;
      // SOF0 / SOF2 etc.
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = (buf[i + 5] << 8) | buf[i + 6];
        const width = (buf[i + 7] << 8) | buf[i + 8];
        if (width > 0 && height > 0) return { width, height, type: 'jpg' };
      }
      i += 2 + len;
    }
  }

  // WebP (RIFF....WEBP)
  if (
    buf.length >= 30 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (chunk === 'VP8X' && buf.length >= 30) {
      const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
      const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
      if (width > 0 && height > 0) return { width, height, type: 'webp' };
    }
    if (chunk === 'VP8 ' && buf.length >= 30) {
      // lossy: bytes 26-29 little-endian 14-bit
      const width = (buf[26] | (buf[27] << 8)) & 0x3fff;
      const height = (buf[28] | (buf[29] << 8)) & 0x3fff;
      if (width > 0 && height > 0) return { width, height, type: 'webp' };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      if (width > 0 && height > 0) return { width, height, type: 'webp' };
    }
  }

  return null;
}

function readUInt32BE(buf, offset) {
  return (
    ((buf[offset] << 24) >>> 0) +
    (buf[offset + 1] << 16) +
    (buf[offset + 2] << 8) +
    buf[offset + 3]
  );
}

/**
 * Descarga solo los primeros bytes de la imagen y lee dimensiones.
 * @param {string} imageUrl
 * @returns {Promise<{ width: number, height: number, type?: string } | null>}
 */
export async function probeImageDimensions(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'GET',
      headers: {
        Range: `bytes=0-${PROBE_BYTES - 1}`,
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    // Algunos hosts no aceptan Range: reintentar GET completo pero cortando lectura
    if (!res.ok && res.status !== 206) {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    if (!res.ok && res.status !== 206) return null;

    const reader = res.body?.getReader?.();
    if (!reader) {
      const ab = await res.arrayBuffer();
      const slice = ab.byteLength > PROBE_BYTES ? ab.slice(0, PROBE_BYTES) : ab;
      return readImageSizeFromBuffer(new Uint8Array(slice));
    }

    const chunks = [];
    let total = 0;
    while (total < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        chunks.push(value);
        total += value.length;
      }
    }
    try {
      reader.cancel();
    } catch (_) {
      /* ignore */
    }

    const buf = new Uint8Array(Math.min(total, PROBE_BYTES));
    let offset = 0;
    for (const chunk of chunks) {
      const take = Math.min(chunk.length, buf.length - offset);
      buf.set(chunk.subarray(0, take), offset);
      offset += take;
      if (offset >= buf.length) break;
    }
    return readImageSizeFromBuffer(buf);
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Enriquece candidatos sin dimensiones, con límite de concurrencia y de cantidad.
 * @param {Array<object>} candidates
 * @param {{ maxProbes?: number, concurrency?: number }} [options]
 */
export async function enrichCandidatesWithDimensions(candidates, options = {}) {
  const maxProbes = Number.isFinite(options.maxProbes) ? options.maxProbes : 12;
  const concurrency = Number.isFinite(options.concurrency) ? options.concurrency : 4;
  const list = Array.isArray(candidates) ? candidates : [];

  const needProbe = list
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => {
      const w = Number(c.width) || 0;
      const h = Number(c.height) || 0;
      if (w > 0 && h > 0) return false;
      const url = String(c.url || '');
      if (!/^https?:\/\//i.test(url)) return false;
      // Priorizar no-logo por nombre; aún así se pueden sondear logos limitados
      return true;
    })
    .sort((a, b) => probePriority(b.c) - probePriority(a.c))
    .slice(0, maxProbes);

  let cursor = 0;
  async function worker() {
    while (cursor < needProbe.length) {
      const current = needProbe[cursor];
      cursor += 1;
      const dims = await probeImageDimensions(current.c.url);
      if (dims?.width && dims?.height) {
        current.c.width = dims.width;
        current.c.height = dims.height;
        if (dims.type && !current.c.type) current.c.type = dims.type;
        current.c.dimsSource = 'probe';
      } else {
        current.c.dimsSource = 'probe-failed';
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, needProbe.length) }, () => worker());
  await Promise.all(workers);

  return {
    list,
    probed: needProbe.length,
    probedOk: needProbe.filter(({ c }) => c.dimsSource === 'probe').length,
  };
}

function probePriority(c) {
  let p = 0;
  const url = String(c.url || '').toLowerCase();
  const alt = String(c.alt || '').toLowerCase();
  const source = String(c.source || '');
  if (c.inMain) p += 50;
  if (source === 'img-hero' || source === 'img-main') p += 40;
  if (source === 'img') p += 25;
  if (source === 'twitter-image' || source.startsWith('og')) p += 15;
  if (source === 'json-ld') p += 20;
  if (/(food|plato|dish|hero|cover|photo|menu|receta|meal|comida|tupper|paso|footer-food)/i.test(`${url} ${alt}`)) {
    p += 35;
  }
  if (/(logo|favicon|icon|apple-touch)/i.test(url)) p -= 40;
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) p += 5;
  return p;
}
