// Build a minimal release zip for static hosting: only the files the page needs at runtime
// (index.html, css/, js/, static/), no dev server, scripts, docs or git files.
// Usage: npm run build  ->  release/sound-visualizer-web.zip   (no dependencies, plain Node)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'release');
const OUT_FILE = path.join(OUT_DIR, 'sound-visualizer-web.zip');
const INCLUDE = ['index.html', 'css', 'js', 'static']; // files or folders, relative to ROOT
const STORE_EXT = new Set(['.mp3', '.png', '.jpg', '.jpeg', '.webp', '.zip']); // already compressed

// All files under the INCLUDE entries, as forward-slash paths relative to ROOT
function collectFiles() {
    const files = [];
    const walk = (rel) => {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) throw new Error(`Missing build input: ${rel}`);
        if (fs.statSync(abs).isDirectory()) {
            fs.readdirSync(abs).sort().forEach(name => walk(path.posix.join(rel, name)));
        } else {
            files.push(rel);
        }
    };
    INCLUDE.forEach(walk);
    return files;
}

// CRC-32 (IEEE), required by the zip format
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// File modification time in MS-DOS format { time, date }
function dosDateTime(d) {
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
        date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
}

// Write a standard zip: [local header + data]... + central directory + end record
function writeZip(files, outFile) {
    const parts = [], central = [];
    let offset = 0;
    for (const rel of files) {
        const abs = path.join(ROOT, rel);
        const raw = fs.readFileSync(abs);
        const store = STORE_EXT.has(path.extname(rel).toLowerCase());
        const data = store ? raw : zlib.deflateRawSync(raw, { level: 9 });
        const method = store ? 0 : 8;
        const crc = crc32(raw);
        const name = Buffer.from(rel, 'utf8');
        const { time, date } = dosDateTime(fs.statSync(abs).mtime);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);          // version needed
        local.writeUInt16LE(0x0800, 6);      // flag: UTF-8 names
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, data);

        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(20, 4);             // version made by
        cd.writeUInt16LE(20, 6);             // version needed
        cd.writeUInt16LE(0x0800, 8);
        cd.writeUInt16LE(method, 10);
        cd.writeUInt16LE(time, 12);
        cd.writeUInt16LE(date, 14);
        cd.writeUInt32LE(crc, 16);
        cd.writeUInt32LE(data.length, 20);
        cd.writeUInt32LE(raw.length, 24);
        cd.writeUInt16LE(name.length, 28);
        cd.writeUInt32LE(offset, 42);        // where the local header starts
        central.push(cd, name);

        offset += local.length + name.length + data.length;
    }
    const cdSize = central.reduce((s, b) => s + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(offset, 16);
    fs.writeFileSync(outFile, Buffer.concat([...parts, ...central, end]));
}

try {
    const files = collectFiles();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    writeZip(files, OUT_FILE);
    files.forEach(f => console.log('  + ' + f));
    const mb = (fs.statSync(OUT_FILE).size / 1048576).toFixed(2);
    console.log(`Built ${path.relative(ROOT, OUT_FILE)} (${files.length} files, ${mb} MB)`);
} catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
}
