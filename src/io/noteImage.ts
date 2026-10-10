import { t } from "../i18n";

// Notes retain the original screenshot resolution. Unlike canvas thumbnails, technical
// screenshots must remain legible when embedded in Word. Inline bytes travel with .mmst.
export const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readNoteImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)) {
    throw new Error(t("writing.chooseImage"));
  }
  if (file.size > MAX_NOTE_IMAGE_BYTES) throw new Error(t("writing.tooLarge"));
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(t("writing.readFailed")));
    reader.readAsDataURL(file);
  });
  // Normalise non-OOXML bitmap types locally; never fetch remote images.
  if (/^image\/(png|jpeg)$/i.test(file.type)) return original;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(t("writing.decodeFailed")));
    image.src = original;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("writing.convertFailed"));
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}
