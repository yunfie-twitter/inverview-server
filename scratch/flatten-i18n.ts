import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function flatten(data: any, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in data) {
    const value = data[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const resDir = path.join(__dirname, '../src/i18n/resources');

['en.json', 'ko.json'].forEach(file => {
  const filePath = path.join(resDir, file);
  if (fs.existsSync(filePath)) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const flatContent = flatten(content);
    fs.writeFileSync(filePath, JSON.stringify(flatContent, null, 2) + '\n', 'utf-8');
    console.log(`Flattened ${file}`);
  } else {
    console.error(`File not found: ${filePath}`);
  }
});
