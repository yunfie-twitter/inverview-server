const fs = require('fs');
const path = require('path');

const ja = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/resources/ja.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/resources/en.json'), 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
}

const jaKeys = getKeys(ja);
const enKeys = getKeys(en);

const onlyJa = jaKeys.filter(k => !enKeys.includes(k));
const onlyEn = enKeys.filter(k => !jaKeys.includes(k));

console.log('Only in ja.json:', onlyJa);
console.log('Only in en.json:', onlyEn);
