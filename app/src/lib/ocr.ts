import { requireOptionalNativeModule } from 'expo';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

type TextExtractor = { isSupported: boolean; extractTextFromImage(uri: string): Promise<string[]> };

// expo-text-extractor ships native code (ML Kit / Apple Vision), so it is absent in Expo Go and on web.
const native = requireOptionalNativeModule<TextExtractor>('ExpoTextExtractor');
export const nativeOcr = !!native?.isSupported;

// Free cloud OCR (ocr.space) — optional, more accurate than the in-WebView engine.
const cloudKey = process.env.EXPO_PUBLIC_OCR_SPACE_KEY;

type WebEngine = (dataUrl: string) => Promise<string>;
let webEngine: WebEngine | null = null;
export function registerWebOcr(engine: WebEngine | null) {
  webEngine = engine;
}

async function toJpegBase64(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 2200 }); // small print on labels needs pixels
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: cloudKey ? 0.75 : 0.9, base64: true });
  return `data:image/jpeg;base64,${saved.base64}`;
}

async function cloud(dataUrl: string) {
  const body = new FormData();
  body.append('base64Image', dataUrl);
  body.append('language', 'rus');
  body.append('OCREngine', '1');
  body.append('scale', 'true');
  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', headers: { apikey: cloudKey! }, body });
  const json = (await res.json()) as { IsErroredOnProcessing?: boolean; ParsedResults?: { ParsedText: string }[] };
  if (json.IsErroredOnProcessing || !json.ParsedResults) throw new Error('OCR_CLOUD_FAILED');
  return json.ParsedResults.map((r) => r.ParsedText).join('\n');
}

/** Reads text from a photo: native OCR in a dev build, otherwise cloud (if keyed) or the WebView engine. */
export async function recognizeText(uri: string): Promise<string> {
  if (native?.isSupported) {
    const lines = await native.extractTextFromImage(uri.replace('file://', ''));
    return lines.join('\n');
  }
  const dataUrl = await toJpegBase64(uri);
  if (cloudKey) {
    try {
      return await cloud(dataUrl);
    } catch {
      // fall through to the offline engine
    }
  }
  if (!webEngine) throw new Error('OCR_UNAVAILABLE');
  return webEngine(dataUrl);
}
