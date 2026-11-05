import { Capacitor } from '@capacitor/core';

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

/**
 * Entrega un archivo al usuario.
 *  - En la APK: lo escribe en la caché y abre el menú de compartir de Android
 *    (desde ahí se puede guardar en Descargas, Drive, enviarlo por correo, etc.).
 *    El WebView de Android no admite descargas con enlaces blob.
 *  - En el navegador: descarga normal.
 */
export async function saveFile(filename: string, blob: Blob): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    try {
      await Share.share({ title: filename, url: written.uri, dialogTitle: 'Guardar o compartir' });
    } catch (err) {
      if (!/cancel/i.test(String((err as { message?: string })?.message ?? err))) throw err;
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
