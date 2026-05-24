// scripts/generate-models.js
const fs = require('fs');
const path = require('path');

// Папка с модулями
const modulesDir = path.join(__dirname, '../modules');
const outputDir = path.join(__dirname, '../docs');
const outputFile = path.join(outputDir, 'models.json');

// Регулярное выражение для поиска массивов моделей
// Ищет const MODELS = [...] или const MODELS_LIST = [...]
function extractModelsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const patterns = [
    /(?:const|let|var)\s+(?:MODELS|MODELS_LIST)\s*=\s*\[([\s\S]*?)\];/,
    /export\s+const\s+(?:MODELS|MODELS_LIST)\s*=\s*\[([\s\S]*?)\];/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const arrayContent = match[1];
      // Извлекаем строковые id (значения после id:)
      const idMatches = arrayContent.matchAll(/id:\s*["']([^"']+)["']/g);
      const models = [];
      for (const m of idMatches) {
        models.push(m[1]);
      }
      return models;
    }
  }
  return [];
}

function main() {
  // Создаём папку docs, если нет
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
        console.log(`⚠️ ${file}: не найдены модели (ищите MODELS или MODELS_LIST)`);
      }
    }
  }
  
  // Убираем дубликаты (если модель встречается в нескольких файлах)
  const uniqueModels = [...new Set(allModels)];
  uniqueModels.sort(); // сортируем по алфавиту
  
  const output = {
    generatedAt: new Date().toISOString(),
    total: uniqueModels.length,
    models: uniqueModels.map(id => ({ id, provider: id.includes('gemini') ? 'Google' : (id.includes('qwen') ? 'Alibaba' : 'Other') }))
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`✅ Сохранено ${uniqueModels.length} моделей в ${outputFile}`);
}

main();