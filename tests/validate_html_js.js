const fs = require('fs');

function testHtmlScripts(filename) {
  const html = fs.readFileSync(filename, 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIdx = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (/src=["']/i.test(match[0])) continue;
    const code = match[1];
    scriptIdx++;
    try {
      new Function(code);
      console.log(`${filename} script #${scriptIdx}: Syntax OK (${code.length} chars)`);
    } catch (e) {
      console.error(`${filename} script #${scriptIdx} ERROR:`, e.message);
      process.exit(1);
    }
  }
}

testHtmlScripts('index.html');
testHtmlScripts('admin.html');
console.log('ALL HTML SCRIPTS PASSED SYNTAX CHECK!');
