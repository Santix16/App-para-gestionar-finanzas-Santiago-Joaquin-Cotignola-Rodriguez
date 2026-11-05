import { Capacitor, registerPlugin } from '@capacitor/core';

/** Plugin nativo propio (frontend/native/android/DownloadsPlugin.java): guarda en la carpeta Descargas. */
interface DownloadsPlugin {
  save(options: {
    filename: string;
    mimeType: string;
    data: string;
  }): Promise<{ uri: string; filename: string }>;
}
const Downloads = registerPlugin<DownloadsPlugin>('Downloads');

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer el archivo'));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Plan B en Android: escribe el archivo en la caché y abre el menú de compartir. */
async function shareFile(filename: string, data: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, url: written.uri, dialogTitle: 'Guardar o compartir' });
  } catch (err) {
    // Cerrar el menú sin elegir nada no es un error
    if (!/cancel/i.test(String((err as { message?: string })?.message ?? err))) throw err;
  }
}

/**
 * Entrega un archivo al usuario.
 *  - En la APK: lo guarda directamente en la carpeta Descargas del móvil (Android 10 o superior).
 *    Si no se puede, abre el menú de compartir como alternativa.
 *  - En el navegador: descarga normal.
 */
export async function saveFile(filename: string, blob: Blob): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob);
    try {
      await Downloads.save({
        filename,
        mimeType: blob.type || 'application/octet-stream',
        data,
      });
    } catch (err) {
      console.warn('No se pudo guardar en Descargas; se usa el menú de compartir', err);
      await shareFile(filename, data);
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
