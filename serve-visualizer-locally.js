// Minimal static server (localhost only) - needed because file:// blocks ES modules and the Web Audio analyser (CORS)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const ROOT = __dirname;
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
    try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
        // Block path traversal outside the project folder
        if (!filePath.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }

        fs.stat(filePath, (err, stat) => {
            if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Content-Length': stat.size
            });
            fs.createReadStream(filePath).pipe(res);
        });
    } catch (e) {
        res.writeHead(400).end('Bad request');
    }
}).listen(PORT, '127.0.0.1', () => console.log(`Visualizer running at http://localhost:${PORT}`));
