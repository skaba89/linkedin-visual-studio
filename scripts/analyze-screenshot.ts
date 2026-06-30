import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

async function main() {
  const imagePath = "/home/z/my-project/scripts/screenshot_small.jpg";
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  console.log("Image size (bytes):", imageBuffer.length);

  const zai = await ZAI.create();

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Décris en détail cette capture d'écran. Reproduis exactement le texte visible (URLs, messages d'erreur, labels).",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  console.log("=== VLM RESPONSE ===");
  console.log(response.choices[0]?.message?.content);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
