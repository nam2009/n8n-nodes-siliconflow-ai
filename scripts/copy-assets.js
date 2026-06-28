// 编译后把 SVG / PNG 等静态资源从 src 复制到 dist，保持目录结构
// 用法：node scripts/copy-assets.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'nodes');
const DST = path.join(ROOT, 'dist', 'nodes');

const ASSET_EXT = /\.(svg|png|jpg|jpeg|gif|ico)$/i;

function copyRecursive(srcDir, dstDir) {
	if (!fs.existsSync(srcDir)) return;
	fs.mkdirSync(dstDir, { recursive: true });
	for (const name of fs.readdirSync(srcDir)) {
		const src = path.join(srcDir, name);
		const dst = path.join(dstDir, name);
		const stat = fs.statSync(src);
		if (stat.isDirectory()) {
			copyRecursive(src, dst);
		} else if (ASSET_EXT.test(name)) {
			fs.copyFileSync(src, dst);
			console.log(`copy asset: ${path.relative(ROOT, src)} -> ${path.relative(ROOT, dst)}`);
		}
	}
}

console.log('Copying node assets (svg/png/...) from src to dist...');
copyRecursive(SRC, DST);
console.log('Done.');
