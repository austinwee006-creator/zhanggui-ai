import Anthropic from "@anthropic-ai/sdk";
import {
  normalizeRestaurantProfile,
  restaurantProfileSummary,
  type RestaurantProfile,
} from "../../lib/restaurantProfile";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
type ResponseLanguage = "zh" | "en";

function buildPrompt(tool: string, inputs: Record<string, string>, profile?: Partial<RestaurantProfile>, language: ResponseLanguage = "zh"): string {
  const restaurantProfile = normalizeRestaurantProfile(profile);
  const context = `本店资料：\n${restaurantProfileSummary(restaurantProfile)}\n\n`;
  const outputLanguage = language === "en" ? "English" : "繁体中文";

  switch (tool) {
    case "menu":
      return `${context}你是专业的餐饮产品文案撰写师，用词生动精准，能激发食欲和下单欲望。

为以下餐饮产品撰写可直接使用的菜单/平台/社媒文案：

产品/菜品名：${inputs.dishName}
主要卖点/食材：${inputs.ingredients || "（未提供）"}
做法/交付方式：${inputs.cookingMethod || "（未提供）"}
定位风格：${inputs.style}
输出语言：${inputs.language}

请按以下格式输出：

**标题**
（在原菜名基础上加修饰，10字内，吸引眼球）

**菜单描述**
（2-3句，突出食材品质、口感、场景、外卖/自取/堂食价值，约50字）

**亮点标签**
（2-3个关键词，如：主推必点、今日限定、适合外送、聚会推荐）

要求：自然流畅，不夸张，符合${inputs.style}定位，并贴合本店业态、主推产品和回复语气。`;

    case "whatsapp":
      return `${context}你是${inputs.restaurantName || restaurantProfile.name || "餐饮品牌"}的专业客服代表。

顾客消息：${inputs.customerMessage}
情境类型：${inputs.context}
品牌补充信息：${inputs.restaurantInfo || "（无）"}
回复语言：${inputs.language}

请撰写一条 WhatsApp 回复：
- 不超过80字
- 亲切专业，符合即时通讯风格和本店回复语气
- 直接解决顾客诉求
- 结尾包含明确的行动引导
- 可自然带入本店营业时间、主推产品、外送/自取/预订/活动餐饮能力，但不要硬塞

只输出回复内容，不要加任何解释或引号。`;

    case "video":
      return `${context}你是专业餐饮短视频内容策划师，擅长为${inputs.platform}创作高完播率内容。

餐饮品牌：${inputs.restaurantName || restaurantProfile.name || "餐饮品牌"}
视频主题：${inputs.topic}
平台：${inputs.platform}
时长：${inputs.duration}
风格：${inputs.style}
输出语言：${outputLanguage}

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

镜头描述要具体可执行，字幕简短有力，并优先突出本店主推产品、业态定位、外卖/自取/堂食/活动餐饮能力。`;

    default:
      throw new Error("Unknown tool: " + tool);
  }
}

export async function POST(request: Request) {
  try {
    const { tool, inputs, profile, language } = await request.json();
    const responseLanguage: ResponseLanguage = language === "en" ? "en" : "zh";
    const userPrompt = buildPrompt(tool, inputs, profile, responseLanguage);

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: responseLanguage === "en" ? "You are an AI assistant for F&B operations. Reply in English unless the user explicitly asks for another language. Keep content concise, direct, immediately usable, and avoid extra explanation." : "你是餐饮运营 AI 助手。回覆使用繁体中文（除非用户指定其他语言）。内容简洁直接，可立即使用，不加多余解释。",
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
