import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { deflateRawSync } from 'zlib';

const WORKSPACE = '/home/runner/workspace';
const OUTPUT = '/home/runner/workspace/coopvest-africa.zip';

const INCLUDE_DIRS = [
  'artifacts/coopvest-admin/src',
  'artifacts/coopvest-admin/public',
  'artifacts/api-server/src',
  'lib/api-client-react/src',
  'lib/api-zod/src',
  'lib/db/src',
  'lib/api-spec',
  'scripts',
];

const INCLUDE_FILES = [
  'README.md',
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  '.gitignore',
  'artifacts/coopvest-admin/package.json',
  'artifacts/coopvest-admin/vite.config.ts',
  'artifacts/coopvest-admin/tsconfig.json',
  'artifacts/coopvest-admin/index.html',
  'artifacts/coopvest-admin/components.json',
  'artifacts/api-server/package.json',
  'artifacts/api-server/tsconfig.json',
  'artifacts/api-server/build.mjs',
  'lib/db/package.json',
  'lib/db/tsconfig.json',
  'lib/db/drizzle.config.ts',
  'lib/api-spec/package.json',
  'lib/api-spec/orval.config.ts',
  'lib/api-zod/package.json',
  'lib/api-zod/tsconfig.json',
  'lib/api-client-react/package.json',
  'lib/api-client-react/tsconfig.json',
];

const SKIP_NAMES = new Set([
  'node_modules', '.git', 'dist', '.cache', '.local', '.agents',
  'attached_assets', 'mockup-sandbox', 'seed-security.ts',
]);
const SKIP_EXTS = new Set(['.tsbuildinfo', '.map']);
const SKIP_FILES = new Set([
  'coopvest-africa.zip', 'coopvest-source.tar.gz',
  'coopvest-africa-admin-dashboard.tar.gz', '.replit-artifact',
]);

function shouldSkip(name) {
  if (SKIP_NAMES.has(name)) return true;
  if (SKIP_FILES.has(name)) return true;
  const ext = '.' + name.split('.').pop();
  if (SKIP_EXTS.has(ext)) return true;
  return false;
}

function collectDir(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (shouldSkip(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectDir(full, files);
    else files.push(full);
  }
  return files;
}

const seen = new Set();
const allFiles = [];

function addFile(full) {
  if (existsSync(full) && !seen.has(full)) { seen.add(full); allFiles.push(full); }
}

for (const dir of INCLUDE_DIRS) for (const f of collectDir(join(WORKSPACE, dir))) addFile(f);
for (const f of INCLUDE_FILES) addFile(join(WORKSPACE, f));

// ZIP writer
function crc32(buf) {
  const t = [];
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c; }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u16(b, o, v) { b[o] = v & 0xFF; b[o+1] = (v >> 8) & 0xFF; }
function u32(b, o, v) { b[o] = v & 0xFF; b[o+1] = (v >> 8) & 0xFF; b[o+2] = (v >> 16) & 0xFF; b[o+3] = (v >> 24) & 0xFF; }

const now = new Date();
const dosDate = ((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
const dosTime = (now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2);

const parts = [], central = [];
let offset = 0;

for (const filePath of allFiles) {
  const rel = 'coopvest-africa/' + relative(WORKSPACE, filePath);
  const nameBytes = Buffer.from(rel, 'utf8');
  const data = readFileSync(filePath);
  const crc = crc32(data);
  const compressed = deflateRawSync(data, { level: 6 });
  const useComp = compressed.length < data.length;
  const outData = useComp ? compressed : data;
  const method = useComp ? 8 : 0;

  const lh = Buffer.alloc(30 + nameBytes.length);
  u32(lh,0,0x04034b50); u16(lh,4,20); u16(lh,6,0); u16(lh,8,method);
  u16(lh,10,dosTime); u16(lh,12,dosDate); u32(lh,14,crc);
  u32(lh,18,outData.length); u32(lh,22,data.length);
  u16(lh,26,nameBytes.length); u16(lh,28,0); nameBytes.copy(lh,30);

  const cd = Buffer.alloc(46 + nameBytes.length);
  u32(cd,0,0x02014b50); u16(cd,4,20); u16(cd,6,20); u16(cd,8,0);
  u16(cd,10,method); u16(cd,12,dosTime); u16(cd,14,dosDate); u32(cd,16,crc);
  u32(cd,20,outData.length); u32(cd,24,data.length); u16(cd,28,nameBytes.length);
  u16(cd,30,0); u16(cd,32,0); u16(cd,34,0); u16(cd,36,0); u32(cd,38,0); u32(cd,42,offset);
  nameBytes.copy(cd,46);

  parts.push(lh, outData);
  central.push(cd);
  offset += lh.length + outData.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
u32(eocd,0,0x06054b50); u16(eocd,4,0); u16(eocd,6,0);
u16(eocd,8,central.length); u16(eocd,10,central.length);
u32(eocd,12,cdBuf.length); u32(eocd,16,offset); u16(eocd,20,0);

const zip = Buffer.concat([...parts, cdBuf, eocd]);
writeFileSync(OUTPUT, zip);
console.log(`\n✅  ${OUTPUT}`);
console.log(`   ${allFiles.length} files · ${(zip.length/1024).toFixed(1)} KB\n`);
