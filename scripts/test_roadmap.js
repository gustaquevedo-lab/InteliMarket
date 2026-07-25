const fs = require('fs');
const html = fs.readFileSync('ROADMAP_VERTICALS.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('No script tag'); process.exit(0); }
const js = scriptMatch[1];

// Extract just the body content (without head/script)
const bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
const bodyHTML = bodyMatch ? bodyMatch[1].replace(/<script>[\s\S]*?<\/script>/, '') : '';

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body>' + bodyHTML + '</body></html>', {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.alert = () => {};
window.navigator.clipboard = { writeText: () => Promise.resolve() };

try {
  window.eval(js);
  console.log('EXEC OK - script runs without errors');
  const grid = window.document.getElementById('verticalsGrid');
  const container = window.document.getElementById('verticalsContainer');
  console.log('verticalsGrid children:', grid ? grid.children.length : 'N/A');
  console.log('verticalsContainer children:', container ? container.children.length : 'N/A');
  // Look for the 6 verticals
  const verticals = window.document.querySelectorAll('[data-vertical-id]');
  console.log('verticals found:', verticals.length);
  // Check stat counters
  const completedModules = window.document.getElementById('completedModules');
  if (completedModules) {
    console.log('completedModules:', completedModules.textContent);
  }
  const totalModules = window.document.getElementById('totalModules');
  if (totalModules) {
    console.log('totalModules:', totalModules.textContent);
  }
} catch (e) {
  console.log('EXEC ERROR:', e.message);
  if (e.stack) {
    const lines = e.stack.split('\n').slice(0, 8);
    lines.forEach(l => console.log('  ' + l));
  }
}
