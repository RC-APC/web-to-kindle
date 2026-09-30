// epub.js (ESM) — 纯 JS 生成合法 EPUB（store 模式 ZIP），无外部依赖。
// 在浏览器 Service Worker / Popup 中运行；也可被 node 以 ESM 方式 import 做单元测试。
//
// makeEpub(title, blocks) -> Uint8Array
//   blocks: [{type:'h'|'p'|'img', text?, src?, ext?, bytes?}]
//   - 文本块 ('h' 标题 / 'p' 正文) 只需 text
//   - 图片块 ('img') 需 bytes(Uint8Array) + ext('png'|'jpg')，无 bytes 的会被跳过

function _buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = _buildCrcTable();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function strToBytes(s) { return new TextEncoder().encode(s); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
  });
}

// 按 red-app 验证过的写法构造 store 模式 ZIP（带正确 local-header offset）
function buildZipFixed(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = strToBytes(f.name);
    const data = f.data, crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local); chunks.push(data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, f.offsetStart, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cdStart = offset;
  for (const c of central) { chunks.push(c); offset += c.length; }
  const cdSize = offset - cdStart;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);
  chunks.push(end);

  const total = chunks.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of chunks) { out.set(a, p); p += a.length; }
  return out;
}

const CONTAINER = strToBytes(
  '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
  '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
);

export function makeEpub(title, blocks) {
  const tEsc = esc(title || "网页");
  const bodyParts = [];
  let manifestItems = "";
  let imgIndex = 0;
  const imgFiles = [];

  for (const b of (blocks || [])) {
    if (b.type === "h") {
      bodyParts.push("<h2>" + esc(b.text) + "</h2>");
    } else if (b.type === "p") {
      bodyParts.push("<p>" + esc(b.text || "") + "</p>");
    } else if (b.type === "img" && b.bytes) {
      const ext = (b.ext === "png") ? "png" : "jpg";
      const href = "images/img" + imgIndex + "." + ext;
      bodyParts.push('<img src="' + href + '" alt="图' + (imgIndex + 1) + '"/>');
      manifestItems += '<item id="img' + imgIndex + '" href="' + href +
        '" media-type="image/' + (ext === "png" ? "png" : "jpeg") + '"/>\n';
      imgFiles.push({ name: "OEBPS/" + href, data: b.bytes });
      imgIndex++;
    }
  }

  const html = strToBytes(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">' +
    '<head><meta charset="utf-8"/><title>' + tEsc + '</title></head><body>' +
    "<h1>" + tEsc + "</h1>\n" + bodyParts.join("\n") + "\n</body></html>"
  );

  const opf = strToBytes(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">\n' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '<dc:identifier id="bookid">urn:uuid:web2kindle</dc:identifier>\n' +
    "<dc:title>" + tEsc + "</dc:title>\n<dc:language>zh</dc:language>\n" +
    '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>\n</metadata>\n' +
    '<manifest>\n<item id="nav" href="text.html" media-type="application/xhtml+xml"/>\n' +
    manifestItems + "</manifest>\n<spine><itemref idref=\"nav\"/></spine>\n</package>"
  );

  const files = [
    { name: "mimetype", data: strToBytes("application/epub+zip") },
    { name: "META-INF/container.xml", data: CONTAINER },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/text.html", data: html }
  ].concat(imgFiles);

  let off = 0;
  for (const f of files) { f.offsetStart = off; off += 30 + strToBytes(f.name).length + f.data.length; }

  return buildZipFixed(files);
}
