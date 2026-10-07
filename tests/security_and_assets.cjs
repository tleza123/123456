const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const sources = ['index.html', 'admin.html', ...fs.readdirSync(path.join(root, 'js')).map(name => 'js/' + name), ...fs.readdirSync(path.join(root, 'css')).map(name => 'css/' + name)];
for (const name of sources) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  for (const pattern of [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /"private_key"\s*:\s*"/, /ADMIN_PASSWORD\s*:\s*['"][^'"]+['"]/, /admin1234/, /fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /backdrop-filter\s*:/, /letter-spacing:\s*-/, /translateZ\(0\)/, /will-change:\s*transform/]) {
    assert(!pattern.test(text), name + ': prohibited credential or presentation pattern');
  }
  if (name.endsWith('.js')) new Function(text);
  if (name.endsWith('.html')) {
    for (const match of text.matchAll(/(?:src|href)="((?:css|js|fonts|media)\/[^"?]+)"/g)) assert(fs.existsSync(path.join(root, match[1])), name + ': missing local asset');
  }
}
const rules = fs.readFileSync(path.join(root, 'AGENTS.md'));
for (const name of ['CLAUDE.md', 'GEMINI.md']) assert(rules.equals(fs.readFileSync(path.join(root, name))), 'Project rule files differ');
assert(fs.readFileSync(path.join(root, 'js/index.js'), 'utf8').includes("iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-popups')"));
console.log('Local assets, script syntax, credential patterns, rendering rules and synchronized project instructions passed. Public Firebase client configuration is intentionally retained.');
