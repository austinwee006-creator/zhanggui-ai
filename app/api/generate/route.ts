import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(tool: string, inputs: Record<string, string>): string {
  switch (tool) {
    case "menu":
      return `你是专业的餐厅菜单文案撰写师，用词生动精准，能激发食欲。

为以下菜品撰写菜单文案：

菜名：${inputs.dishName}
主要食材：${inputs.ingredients || "（未提供）"}
烹饪方式：${inputs.cookingMethod || "（未提供）"}
定位风格：${inputs.style}
输出语言：${inputs.language}

请按以下格式输出：

**标题**
（在原菜名基础上加修饰，10字内，吸引眼球）

**菜单描述**
（2-3句，突出食材品质、烹饪特色、口感层次，约50字）

**亮点标签**
（2-3个关键词，如：招牌必点、主厨推荐、季节限定）

要求：自然流畅，不夸张，符合${inputs.style}定位。`;

    case "whatsapp":
      return `你是${inputs.restaurantName || "餐厅"}的专业客服代表。

顾客消息：${inputs.customerMessage}
情境类型：${inputs.context}
餐厅补充信息：${inputs.restaurantInfo || "（无）"}
回复语言：${inputs.language}

请撰写一条 WhatsApp 回复：
- 不超过80字
- 亲切专业，符合即时通讯风格
- 直接解决顾客诉求
- 结尾包含明确的行动引导

只输出回复内容，不要加任何解释或引号。`;

    case "video":
      return `你是专业餐饮短视频内容策划师，擅长为${inputs.platform}创作高完播率内容。

餐厅/品牌：${inputs.restaurantName || "餐厅"}
视频主题：${inputs.topic}
平台：${inputs.platform}
时长：${inputs.duration}
风格：${inputs.style}

请提供完整拍摄脚本，严格按以下格式：

**开场钩子（0–3秒）**
画面：...
字幕/配音：...

**镜头分解**
[时间段] 画面：... 字幕：...
（根据总时长列出全部镜头）

**BGM建议**
（风格 + 1-2个具体曲目参考）

**结尾 CTA**
（引导观众下一步行动）

镜头描述要具体可执行，字幕简短有力。`;

    default:
      throw new Error("Unknown tool: " + tool);
  }
}

export async function POST(request: Request) {
  try {
    const { tool, inputs } = await request.json();
    const userPrompt = buildPrompt(tool, inputs);

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: "你是餐厅运营 AI 助手。回覆使用繁体中文（除非用户指定其他语言）。内容简洁直接，可立即使用，不加多余解释。",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
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

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
