const fs = require('fs');
const html = fs.readFileSync('ROADMAP_VERTICALS.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('No script tag'); process.exit(0); }
const js = scriptMatch[1];
const bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
const bodyHTML = bodyMatch ? bodyMatch[1].replace(/<script>[\s\S]*?<\/script>/, '') : '';

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body>' + bodyHTML + '</body></html>', {
  url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
window.alert = () => {};
window.navigator.clipboard = { writeText: () => Promise.resolve() };

try {
  window.eval(js);

  // Check vertical sections have correct class
  const sections = window.document.querySelectorAll('.vertical-section');
  console.log('vertical sections:', sections.length);
  sections.forEach((s, i) => {
    console.log(`  [${i}] id=${s.dataset.verticalId} className="${s.className}"`);
  });

  // Check the CSS rule by simulating a click on the first vertical
  const firstSec = sections[0];
  if (firstSec) {
    const hasVs = firstSec.classList.contains('vs');
    console.log(`First section has 'vs' class: ${hasVs}`);
    // Try toggling
    firstSec.classList.add('open');
    const isOpen = firstSec.classList.contains('open');
    console.log(`After add 'open': className="${firstSec.className}", has open=${isOpen}`);
  }
} catch (e) {
  console.log('EXEC ERROR:', e.message);
  console.log(e.stack);
}
