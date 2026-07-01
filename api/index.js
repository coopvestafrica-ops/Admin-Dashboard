const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const file = req.query.file || 'index.html';
  const filePath = join(process.cwd(), file);
  
  try {
    const content = readFileSync(filePath);
    const ext = file.split('.').pop();
    const types = {
      'html': 'text/html; charset=utf-8',
      'js': 'application/javascript',
      'css': 'text/css',
      'svg': 'image/svg+xml',
      'json': 'application/json',
      'jpg': 'image/jpeg',
      'png': 'image/png'
    };
    
    res.setHeader('Content-Type', types[ext] || 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(content);
  } catch (e) {
    res.status(404).send('Not found');
  }
};
