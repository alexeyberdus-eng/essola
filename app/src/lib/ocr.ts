import { requireOptionalNativeModule } from 'expo';

type TextExtractor = { isSupported: boolean; extractTextFromImage(uri: string): Promise<string[]> };

// expo-text-extractor ships native code (ML Kit / Apple Vision), so it is absent in Expo Go and on web.
const native = requireOptionalNativeModule<TextExtractor>('ExpoTextExtractor');

export const ocrAvailable = !!native?.isSupported;

export async function recognizeText(uri: string): Promise<string> {
  if (!native) throw new Error('OCR_UNAVAILABLE');
  const lines = await native.extractTextFromImage(uri.replace('file://', ''));
  return lines.join('\n');
}
