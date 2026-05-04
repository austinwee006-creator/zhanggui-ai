import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `你是 Austin 的餐饮生意 AI 助手，专门协助管理宴会酒楼和单点餐厅（Dinner World / 宾喜楼 / Highlands Seafood）的日常运营。

回覆规则：
- 语言：繁体中文（技术名词保留英文原文）
- 风格：简洁直接，不说空话，建议要能落地执行
- 不加总结段落，不重复问题内容
- 数字和数据要具体，避免模糊表达

专业范围：菜单规划、营销文案、客诉处理、成本控制、员工管理、宴会接单、定价策略、餐厅运营优化。`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
