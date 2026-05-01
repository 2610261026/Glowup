import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Vision Render (Text-to-Image) Route
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, preset, aspectRatio, negativePrompt } = req.body;
      const HF_TOKEN = process.env.HF_TOKEN;

      if (!HF_TOKEN || HF_TOKEN === "your_hugging_face_token_here") {
        return res.status(400).json({ error: "HF_TOKEN not configured." });
      }

      // Construct a high-fidelity prompt
      const finalPrompt = `A high-end cinematic fashion photograph: ${prompt}, ${preset} style, 8k, professional lighting, photorealistic, elegant composition, masterpiece, highly detailed.`;
      
      const response = await axios.post(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
        {
          inputs: finalPrompt,
          parameters: {
            negative_prompt: negativePrompt || "low quality, blurry, distorted face, bad anatomy, deformed hands, cartoon, lowres, text, watermark",
            guidance_scale: 10,
            num_inference_steps: 50,
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
            "x-use-cache": "false"
          },
          responseType: "arraybuffer",
          timeout: 60000
        }
      );

      const base64 = Buffer.from(response.data).toString('base64');
      res.json({ image: `data:image/jpeg;base64,${base64}` });
    } catch (error: any) {
      console.error("Generate Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Generation failed. The model might be loading, try again in 20s." });
    }
  });

  // Style Shift (Image Editing) Route
  app.post("/api/ai/transform", async (req, res) => {
    try {
      const { prompt, image, outfit, preset, params } = req.body;
      const HF_TOKEN = process.env.HF_TOKEN;

      console.log(`[AI] Received transform request. Preset: ${preset}`, params);

      if (!HF_TOKEN || HF_TOKEN === "your_hugging_face_token_here") {
        console.warn("[AI] HF_TOKEN is missing or not configured.");
        return res.status(400).json({ 
          error: "Hugging Face Token not configured. Please add HF_TOKEN to your environment variables (Secrets)." 
        });
      }

      if (!image) {
        return res.status(400).json({ error: "Source image is required" });
      }

      const cleanBase64 = image.split(',')[1] || image;

      // Enhance prompt with granular params
      const lightingText = params?.lighting > 80 ? "ultra-intense dramatic lighting" : params?.lighting < 30 ? "soft ambient lighting" : "balanced studio lighting";
      const physiqueText = params?.physique > 80 ? "hyper-defined athletic physique" : params?.physique < 30 ? "natural authentic body shape" : "refined fit physique";
      const colorText = params?.colorGrade !== 'Neutral' ? `${params.colorGrade} color grading` : "natural color balance";

      const finalPrompt = `Change the person's outfit to ${preset} style. ${prompt}. Apply ${lightingText}, ${physiqueText}, and ${colorText}. High fashion photography, 8k.`;

      const response = await axios.post(
        "https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix",
        {
          inputs: finalPrompt,
          image: cleanBase64,
        },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
            "x-use-cache": "false"
          },
          responseType: "arraybuffer",
          timeout: 60000 // 60s timeout for AI generation
        }
      );

      const base64 = Buffer.from(response.data).toString('base64');
      res.json({ image: `data:image/jpeg;base64,${base64}` });
      console.log("[AI] Transformation successful");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error("AI Proxy Error:", errorMsg);
      
      if (error.response?.status === 503) {
        return res.status(503).json({ error: "AI Model is currently loading/busy. Please try again in 20 seconds." });
      }
      
      res.status(500).json({ error: `Transformation failed: ${errorMsg}` });
    }
  });

  // Razorpay Order Route
  app.post("/api/payment/order", async (req, res) => {
    try {
      const { amount, currency = "INR" } = req.body;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
      });

      const order = await razorpay.orders.create({
        amount: amount * 100, // in paise
        currency,
        receipt: `receipt_${Date.now()}`,
      });

      res.json(order);
    } catch (error) {
      console.error("Payment Order Error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
