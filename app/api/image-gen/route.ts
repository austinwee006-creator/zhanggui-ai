import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, style, background } = await request.json();

    // Step 1: Claude Vision analyzes the food photo
    const analysis = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageBase64 },
            },
            {
              type: "text",
              text: `Analyze this food photo and describe it precisely for a DALL-E 3 food advertising prompt. Include:
- Dish name and main ingredients
- Colors, textures, and presentation style
- Key visual elements

Respond in English only, 2-3 sentences max.`,
            },
          ],
        },
      ],
    });

    const dishDescription = (analysis.content[0] as { type: string; text: string }).text;

    // Step 2: Build DALL-E 3 prompt
    const styleMap: Record<string, string> = {
      "餐厅宣传": "warm restaurant ambiance lighting, cozy dining atmosphere",
      "社媒风格": "trendy flat lay composition, vibrant colors, Instagram-worthy",
      "高端精品": "fine dining presentation, elegant plating, dramatic studio lighting",
      "简洁清新": "minimal clean composition, natural daylight, fresh aesthetic",
    };

    const backgroundMap: Record<string, string> = {
      "木纹桌面": "rustic wooden table surface",
      "大理石": "white marble background",
      "深色背景": "dark slate background with dramatic shadows",
      "白色背景": "pure white background, clean studio look",
    };

    const styleDesc = styleMap[style] || styleMap["餐厅宣传"];
    const bgDesc = backgroundMap[background] || backgroundMap["木纹桌面"];

    const dallePrompt = `Professional food advertisement photography: ${dishDescription} ${styleDesc}, ${bgDesc}, appetizing and mouth-watering, commercial food photography quality, sharp focus, highly detailed, 4K resolution. Shot for a restaurant menu or social media promotion.`;

    // Step 3: Generate with DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = imageResponse.data?.[0]?.url;

    return Response.json({ imageUrl, dishDescription });
  } catch (error) {
    console.error("Image gen error:", error);
    return Response.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
