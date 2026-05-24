// modules/qwen.js — поддержка Qwen и DeepSeek через DashScope API
export const name = 'qwen';

// Список моделей из вашего скриншота (все с бесплатными квотами)
const MODELS = [
  'qwen-vl-ocr-2025-11-20', 'qwen3.5-122b-a10b', 'qwen3-vl-235b-a22b-thinking',
  'qwen-plus-2025-07-28', 'qwen3-max', 'qwen3.5-plus-2026-02-15', 'qwen-max',
  'qwen-mt-flash', 'qwen3-235b-a22b-thinking-2507', 'qwen3-vl-30b-a3b-thinking',
  'qwen3.6-plus', 'qwen3.6-max-preview', 'qwen3-32b', 'qwen3.5-397b-a17b',
  'qwen3-vl-plus-2025-09-23', 'qwen3.6-flash', 'qwen-vl-plus', 'deepseek-v3.2',
  'qwen3-coder-next', 'qwen3.5-flash', 'deepseek-v4-flash', 'qwen3.5-35b-a3b',
  'qwen3-30b-a3b-thinking-2507', 'qwen3-coder-plus-2025-09-23', 'qwen-plus-latest',
  'qwen3-coder-480b-a35b-instruct', 'qwen3-max-2026-01-23', 'qwen3-vl-8b-thinking',
  'wan2.2-kf2v-flash', 'qwen-plus-2025-09-11', 'qwen3-vl-flash-2026-01-22',
  'qwen3.5-flash-2026-02-23', 'qwen3-vl-flash-2025-10-15', 'qwen3-max-preview',
  'qwen-vl-max', 'qwen3.7-max-2026-05-20', 'qwen3-vl-30b-a3b-instruct',
  'qwen3-vl-235b-a22b-instruct', 'qwen3-coder-30b-a3b-instruct', 'qwen3-8b',
  'qwen3.6-27b', 'qwen3-235b-a22b', 'qwen-plus', 'qwen-turbo', 'qwen-mt-lite',
  'qwen3-0.6b', 'qwen3.6-flash-2026-04-16', 'qwen3-coder-flash', 'qvq-max',
  'qwen3-vl-plus', 'qwen3-next-80b-a3b-thinking', 'qwen3.5-27b', 'qwen3-30b-a3b',
  'qwen-mt-plus', 'qwen3-vl-flash', 'qwen3-14b', 'qwen3-vl-8b-instruct',
  'qwen3-max-2025-09-23', 'qwen-plus-character', 'deepseek-v4-pro',
  'qwen3-coder-flash-2025-07-28', 'qwen-flash-character', 'qwen3-vl-plus-2025-12-19',
  'qwen-plus-2025-04-28', 'qwen-mt-turbo', 'qwen3.5-plus', 'qwen3-30b-a3b-instruct-2507',
  'qwen-flash', 'qwen-flash-2025-07-28', 'qwen3.6-35b-a3b', 'qwen-plus-2025-07-14',
  'qwen3-235b-a22b-instruct-2507', 'qwq-plus', 'qwen3.6-plus-2026-04-02',
  'qwen3-coder-plus-2025-07-22', 'qwen3.5-plus-2026-04-20', 'qwen3.7-max',
  'qwen-vl-ocr', 'qwen3-next-80b-a3b-instruct', 'qwen3-coder-plus'
];

export function getModels() {
  return MODELS.map(id => ({
    id,
    object: 'model',
    owned_by: 'alibaba',
    context_window: 131072,  // у Qwen большой контекст
    description: 'Qwen model via DashScope (free tier 1M requests)'
  }));
}

export function supportsModel(modelId) {
  return MODELS.includes(modelId);
}

export async function handleChat(request, body, apiKey) {
  const isStream = body.stream === true;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // Конвертация сообщений в формат Qwen
  const messages = [];
  for (const msg of body.messages || []) {
    if (msg.role === 'system') continue; // Qwen не поддерживает system в этом API
    let content = '';
    if (typeof msg.content === 'string') content = msg.content;
    else if (Array.isArray(msg.content)) content = msg.content.map(p => p.text || '').join(' ');
    else if (msg.content?.text) content = msg.content.text;
    else content = JSON.stringify(msg.content);
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content
    });
  }

  const payload = {
    model: body.model,
    input: { messages },
    parameters: {
      result_format: 'message',
      temperature: 0.7,
      max_tokens: 8192,
      top_p: 0.95,
      incremental_output: isStream ? true : false
    }
  };

  const dashscopeEndpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  try {
    const response = await fetch(dashscopeEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.code) {
      return errorResponse(`Qwen API error: ${data.message} (code ${data.code})`, 500);
    }

    const reply = data.output?.choices?.[0]?.message?.content || 'No response from Qwen';

    const result = {
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };

    if (isStream) {
      return streamResponse(result, corsHeaders);
    } else {
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
  } catch (err) {
    return errorResponse(`Proxy error: ${err.message}`, 500);
  }
}

// Вспомогательные функции
function errorResponse(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
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