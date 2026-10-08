/* Yalın ZIP: yalnızca "stored" (sıkıştırmasız) yazar ve kendi ürettiğini okur.
   Bağımlılık yok, çevrimdışı çalışır. Dışa aktar: tek dosya yedeği. */
window.ZIP = (() => {
  const te = new TextEncoder(), td = new TextDecoder();
  function crc32(veri) {
    let t = ZIP._t;
    if (!t) {
      t = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      ZIP._t = t;
    }
    let c = -1;
    for (let i = 0; i < veri.length; i++) c = t[(c ^ veri[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function yaz(dosyalar) {
    // dosyalar: [{ad, veri: Uint8Array}]
    const parc = [], merkezi = [];
    let ofset = 0;
    for (const d of dosyalar) {
      const adB = te.encode(d.ad);
      const crc = crc32(d.veri);
      const bas = new DataView(new ArrayBuffer(30));
      bas.setUint32(0, 0x04034b50, true); bas.setUint16(4, 20, true);
      bas.setUint16(6, 0x0800, true); bas.setUint16(8, 0, true);
      bas.setUint16(10, 0, true); bas.setUint16(12, 0, true);
      bas.setUint32(14, crc, true); bas.setUint32(18, d.veri.length, true);
      bas.setUint32(22, d.veri.length, true);
      bas.setUint16(26, adB.length, true); bas.setUint16(28, 0, true);
      parc.push(bas.buffer, adB, d.veri);
      const m = new DataView(new ArrayBuffer(46));
      m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true);
      m.setUint16(6, 20, true); m.setUint16(8, 0, true);
      m.setUint16(10, 0, true); m.setUint16(12, 0, true);
      m.setUint16(14, 0, true); m.setUint32(16, crc, true);
      m.setUint32(20, d.veri.length, true); m.setUint32(24, d.veri.length, true);
      m.setUint16(28, adB.length, true);
      m.setUint32(42, ofset, true);
      merkezi.push(m.buffer, adB);
      ofset += 30 + adB.length + d.veri.length;
    }
    const mBoy = merkezi.reduce((t, p) => t + (p.byteLength || p.length), 0);
    const son = new DataView(new ArrayBuffer(22));
    son.setUint32(0, 0x06054b50, true);
    son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true);
    son.setUint32(12, mBoy, true); son.setUint32(16, ofset, true);
    const hepsi = [parc, merkezi, [son.buffer]];
    const toplam = hepsi.flat().reduce((t, p) => t + (p.byteLength || p.length), 0);
    const cikti = new Uint8Array(toplam);
    let k = 0;
    for (const grup of hepsi) for (const p of grup) {
      const b = p instanceof ArrayBuffer ? new Uint8Array(p) : p;
      cikti.set(b, k); k += b.length;
    }
    return new Blob([cikti], { type: 'application/zip' });
  }

  async function oku(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const g = new DataView(buf.buffer);
    // End-of-central-directory'yi sondan ara
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65557; i--) {
      if (g.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP değil');
    const adet = g.getUint16(eocd + 10, true);
    let p = g.getUint32(eocd + 16, true);
    const cikti = [];
    for (let n = 0; n < adet; n++) {
      if (g.getUint32(p, true) !== 0x02014b50) throw new Error('bozuk ZIP');
      const yontem = g.getUint16(p + 10, true);
      const adU = g.getUint16(p + 28, true);
      const ekU = g.getUint16(p + 30, true);
      const yorU = g.getUint16(p + 32, true);
      const yer = g.getUint32(p + 42, true);
      const ad = td.decode(buf.slice(p + 46, p + 46 + adU));
      if (yontem !== 0) throw new Error('sıkıştırmalı giriş desteklenmiyor: ' + ad);
      const lb = g.getUint32(yer + 18, true);
      const adU2 = g.getUint16(yer + 26, true);
      const ekU2 = g.getUint16(yer + 28, true);
      const veri = buf.slice(yer + 30 + adU2 + ekU2, yer + 30 + adU2 + ekU2 + lb);
      cikti.push({ ad, veri });
      p += 46 + adU + ekU + yorU;
    }
    return cikti;
  }

  return { yaz, oku };
})();
