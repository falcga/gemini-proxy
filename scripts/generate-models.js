const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../modules');
const outputDir = path.join(__dirname, '../docs');
const outputFile = path.join(outputDir, 'models.json');

function extractModelsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Ищем const MODELS = [...] или const MODELS_LIST = [...]
  const patterns = [
    /(?:const|let|var)\s+(?:MODELS|MODELS_LIST)\s*=\s*\[([\s\S]*?)\];/,
    /export\s+const\s+(?:MODELS|MODELS_LIST)\s*=\s*\[([\s\S]*?)\];/
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const arrayContent = match[1];
      // Сначала ищем объекты с полем id (формат gemini.js)
      const idMatches = arrayContent.matchAll(/id:\s*["']([^"']+)["']/g);
      const models = [];
      for (const m of idMatches) {
        models.push(m[1]);
      }
      if (models.length) return models;
      
      // Иначе ищем простые строки (формат qwen.js)
      const stringMatches = arrayContent.matchAll(/["']([^"']+)["']/g);
      for (const m of stringMatches) {
        const candidate = m[1];
        if (candidate && !candidate.startsWith('owned_by') && !candidate.startsWith('description') && !candidate.includes('://')) {
          models.push(candidate);
        }
      }
      return models;
    }
  }
  return [];
}

function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const allModels = [];
  const files = fs.readdirSync(modulesDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(modulesDir, file);
      const models = extractModelsFromFile(filePath);
      if (models.length) {
        console.log(`✅ ${file}: найдено ${models.length} моделей`);
        allModels.push(...models);
      } else {
        console.log(`⚠️ ${file}: не найдены модели`);
      }
    }
  }

  const uniqueModels = [...new Set(allModels)];
  uniqueModels.sort();
  const output = {
    generatedAt: new Date().toISOString(),
    total: uniqueModels.length,
    models: uniqueModels.map(id => ({ id, provider: id.includes('gemini') ? 'Google' : (id.includes('qwen') || id.includes('deepseek') ? 'Alibaba' : 'Other') }))
  };
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`✅ Сохранено ${uniqueModels.length} моделей в ${outputFile}`);
}

main();
