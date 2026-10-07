const fs = require('fs');
const path = require('path');
module.exports = function readApplication(filename) {
  return fs.readFileSync(filename, 'utf8').replace(/<script\b[^>]*src="(js\/[^\"]+)"[^>]*><\/script>/g, (_, source) => '<script>' + fs.readFileSync(path.resolve(path.dirname(filename), source), 'utf8') + '</script>')
    .replace(/<link\b[^>]*href="(css\/[^\"]+)"[^>]*>/g, (_, source) => '<style>' + fs.readFileSync(path.resolve(path.dirname(filename), source), 'utf8') + '</style>');
};
