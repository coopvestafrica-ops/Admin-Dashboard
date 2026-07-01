const { readFileSync, existsSync } = require('fs');
const { join, dirname } = require('path');

// In Vercel serverless, use /var/task as base
const BASE_DIR = process.env.VERCEL ? '/var/task' : process.cwd();

module.exports = (req, res) => {
  const file = req.query.file || 'index.html';
  
  // Try current directory first
  let filePath = join(BASE_DIR, file);
  if (!existsSync(filePath)) {
    // Try public directory
    filePath = join(BASE_DIR, 'public', file);
  }
  
  if (!existsSync(filePath)) {
    return res.status(404).send('Not found');
  }

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
