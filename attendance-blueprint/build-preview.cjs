'use strict';
const fs = require('node:fs');
const path = require('node:path');
const fragment = fs.readFileSync(path.join(__dirname, 'mockup.fragment.html'), 'utf8');
const page = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>DE TEAM — ตัวอย่างเว็บเช็คชื่อ</title>
<style>
html{font-size:15px;scrollbar-gutter:stable}body{margin:0;padding:1rem;background:#e8eef5;min-height:100dvh}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #004e98;outline-offset:3px}
@media(min-width:640px){html{font-size:15.5px}}@media(min-width:1024px){html{font-size:16px}}@media(min-width:1440px){html{font-size:16.5px}}@media(min-width:1920px){html{font-size:17.5px}}
@media(max-width:639px){body{padding:0}#team-attendance-demo .team-shell{border-radius:0}#team-attendance-demo .team-main{padding-bottom:calc(6rem + env(safe-area-inset-bottom))}#team-attendance-demo .team-navigation{position:fixed;bottom:0;left:0;right:0;margin-inline:auto;width:min(100%,29rem);padding-bottom:calc(.55rem + env(safe-area-inset-bottom));z-index:10}}
</style></head><body>
${fragment}
</body></html>
`;
fs.writeFileSync(path.join(__dirname, 'preview.html'), page);
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), fragment);
process.stdout.write('Created standalone preview' + (process.argv[2] ? ' and inline preview' : '') + '.\n');
