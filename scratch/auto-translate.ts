import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LANGS: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  it: 'Italian',
  uk: 'Ukrainian',
  nl: 'Dutch',
  ca: 'Catalan',
  el: 'Greek',
  sv: 'Swedish',
  es: 'Spanish',
  sr: 'Serbian',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  tr: 'Turkish',
  no: 'Norwegian',
  hu: 'Hungarian',
  fi: 'Finnish',
  fr: 'French',
  vi: 'Vietnamese',
  he: 'Hebrew',
  pl: 'Polish',
  pt: 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  ro: 'Romanian',
  ru: 'Russian',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)'
};

const NATIVE_LANG_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'العربية',
  it: 'Italiano',
  uk: 'Українська',
  nl: 'Nederlands',
  ca: 'Català',
  el: 'Ελληνικά',
  sv: 'Svenska',
  es: 'Español',
  sr: 'Српски',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  tr: 'Türkçe',
  no: 'Norsk',
  hu: 'Magyar',
  fi: 'Suomi',
  fr: 'Français',
  vi: 'Tiếng Việt',
  he: 'עברית',
  pl: 'Polski',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文'
};

const sourcePath = path.join(__dirname, '../src/i18n/resources/ja.json');
const destDir = path.join(__dirname, '../src/i18n/resources');

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function protectPlaceholders(text: string): { text: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const regex = /\{\{[^}]+\}\}/g;
  const processed = text.replace(regex, (match) => {
    const id = `__PH_${placeholders.length}__`;
    placeholders.push(match);
    return id;
  });
  return { text: processed, placeholders };
}

function restorePlaceholders(text: string, placeholders: string[]): string {
  let result = text;
  placeholders.forEach((ph, index) => {
    const phRegex = new RegExp(`__\\s*PH\\s*_\\s*${index}\\s*__`, 'gi');
    result = result.replace(phRegex, ph);
    result = result.replace(`__PH_${index}__`, ph);
  });
  return result;
}

async function translateBatch(values: string[], targetLang: string): Promise<string[]> {
  const protectedItems = values.map(v => protectPlaceholders(v));
  
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.append("client", "gtx");
  url.searchParams.append("sl", "ja");
  url.searchParams.append("tl", targetLang);
  url.searchParams.append("dt", "t");
  
  protectedItems.forEach(item => {
    url.searchParams.append("q", item.text);
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json() as any;
    
    const results: string[] = [];
    if (Array.isArray(data[0])) {
      data[0].forEach((item: any, idx: number) => {
        if (item && item[0]) {
          const restored = restorePlaceholders(item[0], protectedItems[idx]?.placeholders || []);
          results.push(restored);
        } else {
          results.push(values[idx]);
        }
      });
    }
    
    while (results.length < values.length) {
      results.push(values[results.length]);
    }
    return results.slice(0, values.length);
  } catch (error) {
    console.error(`Error in batch translate to ${targetLang}, retrying in 2s...`, error);
    await delay(2000);
    return translateBatch(values, targetLang);
  }
}

async function run() {
  const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  const keys = Object.keys(sourceData);
  const values = keys.map(k => sourceData[k]);

  const BATCH_SIZE = 30;

  for (const langCode of Object.keys(LANGS)) {
    const langName = LANGS[langCode];
    const destPath = path.join(destDir, `${langCode}.json`);

    console.log(`Translating for ${langName} (${langCode})...`);
    const translatedValues: string[] = [];

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      const translatedBatch = await translateBatch(batch, langCode);
      translatedValues.push(...translatedBatch);
      
      console.log(`  Translated ${translatedValues.length}/${values.length} keys...`);
      await delay(500);
    }

    const translatedData: Record<string, string> = {};
    keys.forEach((key, index) => {
      translatedData[key] = translatedValues[index] || values[index];
    });

    translatedData["settings.languageName"] = NATIVE_LANG_NAMES[langCode] || langName;

    fs.writeFileSync(destPath, JSON.stringify(translatedData, null, 2) + '\n', 'utf-8');
    console.log(`Completed: ${destPath}`);
    await delay(1000);
  }
}

run().catch(console.error);
