const fs = require('fs');
const path = require('path');
const root = process.cwd();
const report = JSON.parse(fs.readFileSync(path.join(root, 'audit-report-data.json'), 'utf8'));
const apiTargets = new Set();
const hrefTargets = new Set();
const srcTargets = new Set();
const missing = [];
const pages = new Set(report.htmlFiles);
for (const ref of report.references) {
  if (ref.kind === 'apiFetchJson' || ref.kind === 'fetch') apiTargets.add(ref.target);
  if (ref.kind === 'href') hrefTargets.add(ref.target);
  if (ref.kind === 'src') srcTargets.add(ref.target);
}
for (const issue of report.issues) {
  if (issue.type === 'missing-file') missing.push(issue);
}
const summary = {
  totalHtml: report.htmlFiles.length,
  totalJs: report.jsFiles.length,
  totalJson: report.jsonFiles.length,
  missingFiles: missing,
  apiTargets: [...apiTargets].sort(),
  hrefTargets: [...hrefTargets].sort(),
  srcTargets: [...srcTargets].sort(),
};
console.log(JSON.stringify(summary, null, 2));
