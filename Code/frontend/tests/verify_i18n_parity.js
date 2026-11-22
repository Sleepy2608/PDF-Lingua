const fs = require('fs');
const content = fs.readFileSync('Code/frontend/js/i18n.js', 'utf8');

const viMatch = content.match(/vi:\s*\{([\s\S]*?)\n\s*\},/);
const enMatch = content.match(/en:\s*\{([\s\S]*?)\n\s*\}\s*\n\s*\};/);

function extractKeys(text) {
    const keys = [];
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        const m = trimmed.match(/^"([^"]+)":/);
        if (m) {
            keys.push(m[1]);
        }
    }
    return keys;
}

const viKeys = extractKeys(viMatch[1]);
const enKeys = extractKeys(enMatch[1]);
const viSet = new Set(viKeys);
const enSet = new Set(enKeys);

console.log('VI keys count:', viKeys.length, '(unique:', viSet.size, ')');
console.log('EN keys count:', enKeys.length, '(unique:', enSet.size, ')');

const missingInEn = viKeys.filter(k => !enSet.has(k));
const missingInVi = enKeys.filter(k => !viSet.has(k));

console.log('Missing in EN:', missingInEn);
console.log('Missing in VI:', missingInVi);

if (missingInEn.length === 0 && missingInVi.length === 0) {
    console.log('[SUCCESS] 100% dictionary parity between VI and EN!');
} else {
    process.exitCode = 1;
}
