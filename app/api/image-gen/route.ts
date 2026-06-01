export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI, { toFile } from "openai";

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { imageBase64, mimeType, style, background } = await request.json();

    const styleMap: Record<string, string> = {
      "品牌宣传": "professional food brand campaign lighting, appetizing commercial atmosphere",
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

    const styleDesc = styleMap[style] || styleMap["品牌宣传"];
    const bgDesc = backgroundMap[background] || backgroundMap["木纹桌面"];

    const imageBuffer = Buffer.from(imageBase64, "base64");
    const imageFile = await toFile(imageBuffer, "food.jpg", { type: mimeType });

    const prompt = `Enhance this food or beverage product photo into a professional food brand advertisement image. Keep the exact same product, ingredients, and portion visible. Improve: professional studio lighting, refined presentation, ${styleDesc}, ${bgDesc}. Make it look highly appetizing and commercially attractive for a menu, delivery platform, or social media campaign. Photorealistic style.`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      n: 1,
      size: "1024x1024",
    });

    const b64 = response.data?.[0]?.b64_json;
    const imageUrl = b64
      ? `data:image/png;base64,${b64}`
      : response.data?.[0]?.url;

    return Response.json({ imageUrl });
  } catch (error) {
    console.error("Image gen error:", error);
    return Response.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
