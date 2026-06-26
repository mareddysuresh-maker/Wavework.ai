import fs from 'fs';
import path from 'path';

const searchTerms = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEMBER', 'EMPLOYEE'];
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.tempmediaStorage'];

function walk(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (ignoreDirs.includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else {
      const ext = path.extname(file);
      if (['.js', '.ts', '.tsx', '.prisma'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const allFiles = walk('.');
const matches = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    for (const term of searchTerms) {
      if (line.includes(term)) {
        matches.push({
          file: file.replace(/\\/g, '/'),
          lineNum,
          term,
          content: line.trim()
        });
      }
    }
  });
}

console.log(JSON.stringify(matches, null, 2));
