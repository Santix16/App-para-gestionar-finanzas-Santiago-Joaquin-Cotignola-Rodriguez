// Prepara el frontend para la APK en modo local:
//  1) activa LOCAL_MODE (datos en el móvil, sin API ni login);
//  2) empaqueta Roboto y Material Icons dentro de la app (sin depender del CDN de Google).
// Requiere: npm i --no-save @fontsource/roboto material-icons
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, s) => writeFileSync(join(root, p), s);

// 1) Modo local
write(
  'src/app/core/app-mode.ts',
  '// Generado por scripts/prepare-local.mjs para la APK\nexport const LOCAL_MODE = true;\n',
);

// 2) Fuentes dentro de la app
const fontStyles = [
  '@fontsource/roboto/latin-300.css',
  '@fontsource/roboto/latin-400.css',
  '@fontsource/roboto/latin-500.css',
  '@fontsource/roboto/latin-700.css',
  'material-icons/iconfont/material-icons.css',
];
for (const f of fontStyles) {
  if (!existsSync(join(root, 'node_modules', f))) {
    console.error(`Falta ${f}. Ejecuta: npm i --no-save @fontsource/roboto material-icons`);
    process.exit(1);
  }
}

const angular = JSON.parse(read('angular.json'));
const project = Object.values(angular.projects)[0];
const options = project.architect.build.options;
options.styles = [...fontStyles.map((f) => `node_modules/${f}`), ...(options.styles ?? [])];
write('angular.json', JSON.stringify(angular, null, 2) + '\n');

const html = read('src/index.html').replace(/^[ \t]*<link[^>]*fonts\.g(?:oogleapis|static)\.com[^>]*>\r?\n?/gim, '');
write('src/index.html', html);

console.log('Frontend preparado para la versión local (LOCAL_MODE = true, fuentes incluidas).');
