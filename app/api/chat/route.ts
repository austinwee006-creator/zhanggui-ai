import Anthropic from "@anthropic-ai/sdk";
import {
  normalizeRestaurantProfile,
  restaurantProfileSummary,
  type RestaurantProfile,
} from "../../lib/restaurantProfile";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type ResponseLanguage = "zh" | "en";

function systemPrompt(language: ResponseLanguage) {
  if (language === "en") {
    return `You are an AI business assistant for restaurant and F&B owners. You help owners manage dine-in, delivery, pickup, catering, content marketing, lead generation, order follow-up and daily operations.

Reply rules:
- Language: English
- Style: concise, direct, practical, and executable
- Do not add a summary section or repeat the question
- Use specific numbers and concrete steps where useful
- Never mention developers, demo brands, or internal test brands

Scope: menu/product planning, marketing copy, customer replies, complaint handling, cost control, staff management, order records, booking/delivery/catering intake, lead channels, private customer follow-up, pricing strategy, and F&B operations optimization.`;
  }

  return `你是餐饮生意 AI 助手，专门协助各类餐饮企业老板管理堂食、外卖、自取、活动餐饮、内容营销、客源开发、订单跟进和日常运营。

回覆规则：
- 语言：繁体中文（技术名词保留英文原文）
- 风格：简洁直接，不说空话，建议要能落地执行
- 不加总结段落，不重复问题内容
- 数字和数据要具体，避免模糊表达
- 不要提到任何开发者、示范品牌或内部测试品牌

专业范围：菜单/产品规划、营销文案、顾客回复、客诉处理、成本控制、员工管理、订单记录、预订/外卖/活动餐饮接单、获客渠道、私域回访、定价策略、餐饮运营优化。`;
}

function buildSystemPrompt(profile?: Partial<RestaurantProfile>, language: ResponseLanguage = "zh") {
  const restaurantProfile = normalizeRestaurantProfile(profile);

  if (language === "en") {
    return `${systemPrompt(language)}

Current F&B brand profile:
${restaurantProfileSummary(restaurantProfile)}

How to use the profile:
- Prioritize the current brand profile and avoid generic advice
- For customer replies, order intake, menu/product suggestions and lead generation, naturally use the brand name, business type, signature products/services, opening hours and sales tone
- If the profile is incomplete, directly list the 1-3 key details the owner should add.`;
  }

  return `${systemPrompt(language)}

当前餐饮品牌资料：
${restaurantProfileSummary(restaurantProfile)}

使用方式：
- 回答时优先结合当前餐饮品牌资料，不要给过度通用的建议
- 涉及顾客回复、订单接单、菜单/产品建议、客源开发时，自动带入品牌名称、业态定位、主推产品/服务、营业时间和成交语气
- 如果资料不足，直接列出还需要老板补充的 1-3 个关键资料。`;
}

export async function POST(request: Request) {
  try {
    const { messages, profile, language } = await request.json();
    const responseLanguage: ResponseLanguage = language === "en" ? "en" : "zh";

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(profile, responseLanguage),
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
