// modules/gemini.js — полная версия, перенесённая из вашего монолитного worker.js
export const name = 'gemini';

// ==================== СПИСОК МОДЕЛЕЙ ====================
const MODELS_LIST = [
  { id: "gemini-3.5-flash", owned_by: "google", context_window: 1_048_576, description: "Gemini 3.5 Flash (May 2026)" },
  { id: "gemini-3.1-flash-lite", owned_by: "google", context_window: 1_048_576, description: "Gemini 3.1 Flash Lite (stable)" },
  { id: "gemini-3.1-flash-lite-preview", owned_by: "google", context_window: 1_048_576, description: "Gemini 3.1 Flash Lite Preview" },
  { id: "gemini-3-flash-preview", owned_by: "google", context_window: 1_048_576, description: "Gemini 3 Flash Preview" },
  { id: "gemini-3-pro-preview", owned_by: "google", context_window: 1_048_576, description: "Gemini 3 Pro Preview" },
  { id: "gemini-2.5-flash", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.5 Flash (stable)" },
  { id: "gemini-2.5-flash-lite", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.5-pro", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.5 Pro (stable)" },
  { id: "gemini-2.0-flash", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-001", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.0 Flash 001" },
  { id: "gemini-2.0-flash-lite-001", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.0 Flash-Lite 001" },
  { id: "gemini-2.0-flash-lite", owned_by: "google", context_window: 1_048_576, description: "Gemini 2.0 Flash-Lite" },
  { id: "gemma-4-31b-it", owned_by: "google", context_window: 262_144, description: "Gemma 4 31B IT" },
  { id: "gemma-4-26b-a4b-it", owned_by: "google", context_window: 262_144, description: "Gemma 4 26B A4B IT" }
];

export function getModels() {
  return MODELS_LIST.map(m => ({ ...m, object: 'model' }));
}

export function supportsModel(modelId) {
  return MODELS_LIST.some(m => m.id === modelId);
}

// ==================== МАППИНГ И FALLBACK ====================
function mapToApiModel(openaiModel) {
  const mapping = {
    "gemini-3.5-flash": "gemini-3.5-flash",
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview": "gemini-3-flash-preview",
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-2.0-flash-001": "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001": "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
    "gemma-4-31b": "gemma-4-31b-it",
    "gemma-4-26b": "gemma-4-26b-a4b-it"
  };
  return mapping[openaiModel] || openaiModel;
}

function getFallbackChain(model) {
  let normalized = model;
  if (model === "gemma-4-31b") normalized = "gemma-4-31b-it";
  if (model === "gemma-4-26b") normalized = "gemma-4-26b-a4b-it";

  if (model === "gemini-3.5-flash") {
    return [
      { openai: model, gemini: mapToApiModel(model) },
      { openai: "gemini-3.1-flash-lite", gemini: "gemini-3.1-flash-lite" },
      { openai: "gemini-2.5-flash", gemini: "gemini-2.5-flash" },
      { openai: "gemma-4-31b", gemini: "gemma-4-31b-it" }
    ];
  }
  if (model === "gemini-3-flash-preview") {
    return [
      { openai: model, gemini: "gemini-3-flash-preview" },
      { openai: "gemini-2.5-flash", gemini: "gemini-2.5-flash" },
      { openai: "gemini-3.1-flash-lite", gemini: "gemini-3.1-flash-lite" },
      { openai: "gemma-4-31b", gemini: "gemma-4-31b-it" }
    ];
  }
  if (model.startsWith("gemma")) {
    return [
      { openai: model, gemini: mapToApiModel(model) },
      { openai: "gemini-2.5-flash", gemini: "gemini-2.5-flash" },
      { openai: "gemini-3.1-flash-lite", gemini: "gemini-3.1-flash-lite" }
    ];
  }
  return [
    { openai: model, gemini: mapToApiModel(model) },
    { openai: "gemini-2.5-flash", gemini: "gemini-2.5-flash" },
    { openai: "gemini-3.1-flash-lite", gemini: "gemini-3.1-flash-lite" },
    { openai: "gemma-4-31b", gemini: "gemma-4-31b-it" }
  ];
}

// ==================== ОСНОВНОЙ ОБРАБОТЧИК ====================
export async function handleChat(request, body, apiKey) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const isStream = body.stream === true;

    if (!apiKey) {
      const errorContent = '❌ API key required. Please set Authorization: Bearer <your_gemini_api_key>';
      if (isStream) return streamErrorResponse(errorContent, corsHeaders);
      return new Response(JSON.stringify(buildErrorResponse(body.model || 'unknown', errorContent)), { status: 200, headers: corsHeaders });
    }

    const requestedModel = body.model || 'gemini-2.5-flash';
    const modelFallbackChain = getFallbackChain(requestedModel);

    // Конвертация сообщений из OpenAI формата
    const contents = [];
    let systemInstruction = null;
    for (const msg of body.messages || []) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
        continue;
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let text = '';
      if (typeof msg.content === 'string') text = msg.content;
      else if (Array.isArray(msg.content)) text = msg.content.map(part => part.text || '').join(' ');
      else if (msg.content?.text) text = msg.content.text;
      if (text && text.trim()) contents.push({ role, parts: [{ text }] });
    }

    // Ограничиваем историю 40 сообщениями
    const finalContents = contents.length > 40 ? contents.slice(-40) : contents;
    let lastError = null;

    for (const modelConfig of modelFallbackChain) {
      try {
        const requestBody = { contents: finalContents };
        if (systemInstruction) requestBody.system_instruction = { parts: [{ text: systemInstruction }] };
        requestBody.generationConfig = { temperature: 0.7, maxOutputTokens: 8192, topP: 0.95 };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.gemini}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
        );

        const data = await response.json();
        if (data.error) {
          lastError = data.error;
          console.error(`[${modelConfig.gemini}] Google error:`, data.error);
          if (data.error.code === 429 || data.error.code === 400) break;
          continue;
        }

        if (data.candidates && data.candidates[0]) {
          let responseText = '';
          if (data.candidates[0].content?.parts?.[0]?.text) {
            responseText = data.candidates[0].content.parts[0].text;
          } else if (data.candidates[0].finish_reason === 'SAFETY') {
            responseText = '⚠️ Response blocked by Google safety filters.';
          } else {
            responseText = '⚠️ Empty response from model.';
          }

          const result = {
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: modelConfig.openai,
            choices: [{ index: 0, message: { role: 'assistant', content: responseText }, finish_reason: 'stop' }],
            usage: data.usageMetadata || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };

          if (isStream) {
            return streamResponse(result, corsHeaders);
          } else {
            return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
          }
        }
        lastError = data.error || { message: 'No response from model' };
      } catch (err) {
        lastError = { message: err.message };
        console.error(`[${modelConfig.gemini}] Exception:`, err);
      }
    }

    // Все модели в цепочке не сработали
    const errorContent = `❌ All models failed. Last error: ${lastError?.message || 'unknown'}. Check API key and model availability.`;
    if (isStream) return streamErrorResponse(errorContent, corsHeaders);
    return new Response(JSON.stringify(buildErrorResponse(requestedModel, errorContent)), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('Fatal error in handleChat:', err);
    const errorContent = `❌ Proxy internal error: ${err.message}`;
    const isStream = body.stream === true;
    if (isStream) return streamErrorResponse(errorContent, corsHeaders);
    return new Response(JSON.stringify(buildErrorResponse('unknown', errorContent)), { status: 200, headers: corsHeaders });
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function buildErrorResponse(modelId, errorMessage) {
  return {
    id: 'chatcmpl-error',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: errorMessage },
      finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

function streamResponse(result, corsHeaders) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const firstChunk = {
        id: result.id,
        object: 'chat.completion.chunk',
        created: result.created,
        model: result.model,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(firstChunk)}\n\n`));
      const contentChunk = {
        ...firstChunk,
        choices: [{ index: 0, delta: { content: result.choices[0].message.content }, finish_reason: null }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
      const finalChunk = {
        ...firstChunk,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function streamErrorResponse(errorMessage, corsHeaders) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const errorChunk = {
        id: 'chatcmpl-error',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'unknown',
        choices: [{ index: 0, delta: { content: errorMessage }, finish_reason: 'stop' }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
}