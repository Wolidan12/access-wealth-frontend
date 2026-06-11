const fs = require('fs');
const path = require('path');
const root = process.cwd();
const publicDir = path.join(root, 'public');
const files = fs.readdirSync(publicDir).filter(f => fs.statSync(path.join(publicDir, f)).isFile());
const htmlFiles = files.filter(f => f.endsWith('.html'));
const jsFiles = files.filter(f => f.endsWith('.js'));
const jsonFiles = files.filter(f => f.endsWith('.json'));
const report = { htmlFiles, jsFiles, jsonFiles, pages: [], issues: [], references: [] };

function fileExists(rel) {
  if (!rel) return false;
  const normalized = rel.replace(/^\/?/, '');
  return fs.existsSync(path.join(publicDir, normalized));
}

function addIssue(type, file, line, detail, fix) {
  report.issues.push({ type, file, line, detail, fix });
}

function scanText(file, text) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/g;
    const srcRegex = /src\s*=\s*["']([^"']+)["']/g;
    const winlocRegex = /window\.location\.href\s*=\s*["']([^"']+)["']/g;
    const winlocOpenRegex = /window\.location\.href\s*=\s*["']([^"']+)["']/g;
    const fetchRegex = /fetch\s*\(\s*["']([^"']+)["']/g;
    const apiRegex = /apiFetchJson\s*\(\s*["']([^"']+)["']/g;
    const localStorageRegex = /localStorage\.(getItem|setItem|removeItem)\s*\(\s*["']([^"']+)["']/g;
    const styleHrefRegex = /rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["']/g;
    const scriptSrcRegex = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
    const linkHrefRegex = /<link[^>]+href\s*=\s*["']([^"']+)["']/gi;

    [[hrefRegex, 'href'], [srcRegex, 'src'], [winlocRegex, 'window.location.href'], [fetchRegex, 'fetch'], [apiRegex, 'apiFetchJson']].forEach(([regex, kind]) => {
      let m;
      while ((m = regex.exec(line))) {
        const target = m[1];
        report.references.push({ file, line: lineNumber, kind, target });
        if (kind === 'href' || kind === 'src' || kind === 'window.location.href') {
          if (target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:') || target.startsWith('tel:') || target.startsWith('javascript:')) continue;
          if (target.includes('?')) target = target.split('?')[0];
          const pathCandidate = target.replace(/^\.\//, '');
          if (!fileExists(pathCandidate)) {
            addIssue('missing-file', file, lineNumber, `${kind} target missing: ${target}`, `Create or correct ${target}`);
          }
        }
        if (kind === 'fetch' || kind === 'apiFetchJson') {
          if (target.startsWith('http')) {
            report.references.push({ file, line: lineNumber, kind: 'external-fetch', target });
          } else if (!target.startsWith('/')) {
            addIssue('fetch-path', file, lineNumber, `Relative API path should start with '/': ${target}`, `Use '/${target.replace(/^\/?/, '')}'`);
          }
        }
      }
    });
    const matchLocal = [...line.matchAll(localStorageRegex)];
    matchLocal.forEach(m => {
      report.references.push({ file, line: lineNumber, kind: 'localStorage', action: m[1], key: m[2] });
    });
  });
}

for (const file of htmlFiles) {
  const text = fs.readFileSync(path.join(publicDir, file), 'utf8');
  scanText(file, text);
}
for (const file of jsFiles) {
  const text = fs.readFileSync(path.join(publicDir, file), 'utf8');
  scanText(file, text);
}

// Validate Netlify config
const netlifyPath = path.join(root, 'netlify.toml');
if (fs.existsSync(netlifyPath)) {
  const netlify = fs.readFileSync(netlifyPath, 'utf8');
  if (!/publish\s*=\s*["']public["']/.test(netlify)) addIssue('netlify', 'netlify.toml', 1, 'publish directory not set to public', 'Set publish = "public"');
  if (/redirects/.test(netlify) && !/from\s*=\s*["']\*\*["']/.test(netlify) && !/from\s*=\s*["']\/\*\s*['"]/.test(netlify)) {
    // not necessarily an issue if route is specific
  }
}

fs.writeFileSync(path.join(root, 'audit-report-data.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
