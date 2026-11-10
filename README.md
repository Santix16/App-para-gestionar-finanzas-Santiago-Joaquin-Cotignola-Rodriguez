# Finanzas Personales - Santiago Joaquin Cotignola Rodriguez

Aplicación web desarrollada en Angular para registrar ingresos y gastos, organizarlos por cuentas y categorías, fijar presupuestos mensuales y consultar la situación financiera con gráficas, proyecciones e informes descargables. Funciona de dos formas: como **aplicación web con API y base de datos PostgreSQL** (con cuentas de usuario y sincronización entre dispositivos) y como **APK de Android en modo local**, sin servidor, con los datos guardados en el propio móvil.

## ¿Qué es este proyecto?

Finanzas Personales es una aplicación de gestión económica personal en la que el usuario puede anotar sus movimientos y revisar su evolución mes a mes. Cada movimiento pertenece a una cuenta y a una categoría, y tiene un importe, un tipo (ingreso o gasto), una fecha y una nota opcional.

La mecánica principal consiste en:

- Crear cuentas (banco, efectivo o ahorro) con un saldo inicial.
- Crear categorías de ingreso y de gasto con un color propio, o cargar un conjunto de categorías por defecto.
- Registrar movimientos y consultarlos con filtros por mes, cuenta y categoría, con paginación.
- Fijar un presupuesto mensual por categoría de gasto y ver cuánto se lleva consumido.
- Consultar un resumen del mes: ingresos, gastos, balance, saldo total, gasto por categoría y evolución de los últimos 6 meses.
- Ver una proyección del gasto a fin de mes, comparada con la media de los 3 meses anteriores.
- Descargar el informe del mes en PDF o Excel.
- Eliminar cuentas, categorías, movimientos y presupuestos mediante confirmación.

## Características principales

- Registro e inicio de sesión con sesión segura (versión web).
- Cuentas de tipo banco, efectivo y ahorro, con saldo calculado a partir del saldo inicial y los movimientos.
- Categorías de ingreso y de gasto con color personalizable y botón para crear las categorías por defecto.
- Listado de movimientos con filtros combinables (mes, cuenta y categoría), paginador en español y totales de todo el filtro.
- Presupuestos mensuales con barra de progreso y avisos al llegar al 80 % y al superar el 100 %.
- Panel de resumen con tarjetas de ingresos, gastos, balance y saldo total.
- Gráfica de anillo con el gasto por categoría y gráfica de barras con los últimos 6 meses.
- Proyección de gasto a fin de mes comparada con la media de los tres meses previos.
- Informes del mes en PDF y en Excel (hoja de resumen y hoja de movimientos).
- Selector de mes para navegar entre periodos.
- Modo claro y modo oscuro.
- Diseño responsive adaptado a móvil, con todos los textos en español.
- Confirmaciones personalizadas con Angular Material para eliminar y para operaciones destructivas.
- Mensajes de éxito y de error mediante SnackBar.
- Versión Android (APK) en modo local: sin cuenta, sin servidor y sin conexión, con copia de seguridad exportable e importable.

## Tecnologías utilizadas

**Frontend**

- Angular 21 con componentes standalone, signals y formularios reactivos.
- TypeScript y RxJS.
- Angular Material.
- ng2-charts 10 y Chart.js.
- jsPDF, jsPDF-AutoTable y ExcelJS (informes generados en el móvil en la versión local).
- Capacitor 8 (empaquetado para Android).

**Backend**

- Node.js 22, Express 5 y TypeScript.
- Prisma 6 y PostgreSQL 16.
- Zod 4 para validar la entrada.
- JSON Web Tokens y bcrypt para la autenticación.
- helmet y express-rate-limit para la seguridad.
- ExcelJS y PDFKit para los informes.

**Calidad e infraestructura**

- Vitest y Supertest para las pruebas del backend.
- Docker y Docker Compose (PostgreSQL, API y web con Nginx).
- GitHub Actions: integración continua y compilación del APK.

## Requisitos previos

Necesitarás tener instalado:

- Node.js 22 o superior.
- npm.
- Docker Desktop (para la base de datos PostgreSQL).
- Git.
- Angular CLI, opcionalmente instalado de forma global.
- Un navegador web actualizado.

Para la versión Android no necesitas instalar nada en tu equipo: el APK se compila en GitHub Actions.

## Instalación

Clona el repositorio:

```bash
git clone <URL-DEL-REPOSITORIO>
cd finanzas-app
```

Instala las dependencias del backend:

```bash
cd backend
npm install
cd ..
```

Instala las dependencias del frontend:

```bash
cd frontend
npm install
cd ..
```

## Scripts disponibles

**Backend** (`backend/`)

| Script | Comando | Descripción |
| --- | --- | --- |
| dev | `npm run dev` | Inicia la API en modo desarrollo con recarga automática. |
| build | `npm run build` | Compila la API a JavaScript en `dist/`. |
| start | `npm start` | Ejecuta la API compilada. |
| typecheck | `npm run typecheck` | Comprueba los tipos sin generar archivos. |
| test | `npm test` | Ejecuta las pruebas con Vitest y Supertest. |

**Frontend** (`frontend/`)

| Script | Comando | Descripción |
| --- | --- | --- |
| start | `npm start` o `npx ng serve` | Inicia Angular en modo desarrollo. |
| build | `npx ng build` | Compila la aplicación Angular. |

## Cómo ejecutar la aplicación

### 1) Levantar la base de datos

Desde la carpeta raíz del proyecto, con Docker Desktop en marcha:

```bash
docker compose up -d
```

### 2) Iniciar la API

En otra terminal, desde `backend/`:

```bash
cp .env.example .env
npx prisma migrate dev
npm run dev
```

En PowerShell usa `Copy-Item .env.example .env` en lugar de `cp`. Antes de arrancar, edita `.env` y define `JWT_SECRET` con una cadena de al menos 32 caracteres. La API queda disponible en `http://localhost:3000`, y `http://localhost:3000/api/health` responde si está funcionando.

### 3) Iniciar la aplicación web

En otra terminal, desde `frontend/`:

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4200/`. Crea una cuenta desde la pantalla de registro y empieza a usarla.

### 4) Ejecutar las pruebas

Desde `backend/`:

```bash
npm run typecheck
npm test
```

### 5) Todo el stack con Docker

```bash
cp .env.example .env
docker compose --profile full up -d --build
```

La web queda en `http://localhost:8080` y la API en `http://localhost:3000`. Sin `--profile full` solo se levanta la base de datos.

### 6) Variables de entorno de la API

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL | obligatoria |
| `JWT_SECRET` | Clave de firma, mínimo 32 caracteres | obligatoria |
| `PORT` | Puerto de la API | `3000` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas | `http://localhost:4200` |
| `COOKIE_SAMESITE` | `lax`, `strict` o `none` (cuando front y API están en dominios distintos) | `lax` |
| `COOKIE_SECURE` | Fuerza el atributo Secure de la cookie | activo en producción |
| `TRUST_PROXY` | Número de proxies de confianza (Render, Railway, Nginx) | `0` |

La API valida el entorno al arrancar y se detiene con un mensaje claro si falta algo.

## Versión Android (APK en modo local)

La misma aplicación Angular se empaqueta como APK con Capacitor. En el APK **no hay login ni servidor**: los datos se guardan en el móvil y la aplicación funciona sin conexión.

### Cómo obtener el APK

1. Sube el proyecto a GitHub.
2. Abre la pestaña **Actions**, elige **Android APK** y pulsa **Run workflow**.
3. Cuando termine, descarga el artefacto `finanzas-apk` (un zip con `app-debug.apk`) e instálalo en el móvil.

El workflow también se ejecuta al subir una etiqueta de versión (`v1.0.0`), y en ese caso adjunta el APK a la release. Es un APK de depuración: cada compilación se firma con una clave distinta, por lo que hay que desinstalar la versión anterior antes de instalar la nueva.

### Qué hace el workflow

1. Instala Node 22, Java 21 y el SDK de Android.
2. Instala las dependencias y empaqueta las fuentes dentro de la app, para que no dependa de internet.
3. Activa el modo local (`LOCAL_MODE = true`) con `frontend/scripts/prepare-local.mjs`.
4. Compila Angular en producción y genera el proyecto Android con Capacitor.
5. Instala el plugin nativo de Descargas.
6. Compila el APK con Gradle y lo publica como artefacto.

### Particularidades del modo local

- Los datos viven en IndexedDB, con `localStorage` como alternativa.
- En el menú aparece **Ajustes** y desaparece "Cerrar sesión".
- Ajustes permite cambiar la moneda, **exportar** y **importar** una copia de seguridad en JSON y borrar todos los datos.
- Los informes PDF y Excel se generan en el móvil y se guardan en la carpeta **Descargas** mediante un plugin nativo propio (`frontend/native/android`).
- Si se desinstala la aplicación, los datos se pierden: conviene exportar una copia de vez en cuando.

## Detalles de implementación

La aplicación está desarrollada con Angular 21 utilizando componentes standalone, signals y rutas con carga diferida. La interfaz está separada en plantillas HTML, clases TypeScript y hojas de estilo SCSS. La comunicación con la API está centralizada en `ApiService`, y la sesión en `AuthService`.

La versión local reutiliza todos los componentes sin tocarlos. En lugar de duplicar la interfaz, la aplicación sustituye mediante inyección de dependencias los servicios `ApiService`, `AuthService` y `ThemeService` por `LocalApiService`, `LocalAuthService` y `LocalThemeService`. Una constante, `LOCAL_MODE`, decide cuál se usa, y el workflow la cambia a `true` al compilar el APK. Un tipo de TypeScript comprueba en compilación que la versión local ofrece exactamente los mismos métodos que la remota.

## Justificación de diseño

Las decisiones de diseño tomadas fueron:

- Usar Angular Material para tarjetas, formularios, selects, tablas, diálogos, paginador y notificaciones, de modo que la interfaz sea coherente.
- Mostrar el resumen en tarjetas con iconos, para leer de un vistazo ingresos, gastos, balance y saldo.
- Usar verde para los ingresos y rojo para los gastos.
- Representar el consumo del presupuesto con una barra de progreso y cambiar su aspecto al llegar al 80 % y al superar el 100 %.
- Ofrecer modo claro y oscuro, que se recuerda entre sesiones.
- Utilizar un diseño responsive pensado primero para móvil, con navegación lateral que se adapta al ancho de la pantalla.
- Mostrar las confirmaciones dentro de diálogos propios con fondo atenuado.
- Mantener los textos visibles de la interfaz en español.

## Documentación técnica de los componentes visuales creados

### 1. LayoutComponent

**Propósito:** estructura general de la aplicación una vez iniciada la sesión.

**Funcionalidad:** muestra la barra superior y el menú de navegación (Resumen, Movimientos, Cuentas, Categorías, Presupuestos e Informes), el botón de cambio de tema y el de cerrar sesión. En el modo local oculta "Cerrar sesión" y añade "Ajustes".

### 2. DashboardComponent

**Propósito:** mostrar el resumen económico del mes seleccionado.

**Funcionalidad:** carga el resumen desde el servicio y muestra las tarjetas de ingresos, gastos, balance y saldo total, la proyección de gasto a fin de mes, la gráfica de anillo del gasto por categoría, la gráfica de barras de los últimos 6 meses y el estado de los presupuestos.

### 3. TransactionsComponent y TransactionDialogComponent

**Propósito:** listar, crear, editar y eliminar movimientos.

**Funcionalidad:** el listado se filtra por mes, cuenta y categoría, se pagina en el servidor y muestra los totales de ingresos y gastos de todo el filtro. El diálogo valida el importe, la fecha, la cuenta y la categoría, y exige que el tipo del movimiento coincida con el de la categoría.

### 4. AccountsComponent

**Propósito:** gestionar las cuentas.

**Funcionalidad:** formulario para crear o editar una cuenta (nombre, tipo y saldo inicial) y tarjetas con el saldo actual de cada una. Eliminar una cuenta elimina también sus movimientos, y por eso pide confirmación.

### 5. CategoriesComponent

**Propósito:** gestionar las categorías de ingreso y de gasto.

**Funcionalidad:** formulario con nombre, tipo y color, listas separadas por tipo y un botón para crear las categorías por defecto. No se puede eliminar una categoría que tenga movimientos asociados.

### 6. BudgetsComponent

**Propósito:** fijar y seguir los presupuestos del mes.

**Funcionalidad:** permite asignar un límite a una categoría de gasto en el mes seleccionado, o actualizarlo si ya existía. Muestra lo gastado, el límite, el porcentaje y una barra de progreso, con aviso al llegar al 80 % y al superar el 100 %.

### 7. ReportsComponent

**Propósito:** descargar el informe del mes.

**Funcionalidad:** dos acciones, descargar el informe en PDF o en Excel. En la versión web los genera la API; en el modo local se generan en el móvil y se guardan en Descargas.

### 8. SettingsComponent (modo local)

**Propósito:** ajustes de la versión Android.

**Funcionalidad:** cambiar la moneda, exportar e importar una copia de seguridad en JSON y borrar todos los datos, con confirmación en las acciones destructivas.

### 9. MonthPickerComponent

**Propósito:** seleccionar el mes que se consulta en las pantallas.

**Funcionalidad:** permite avanzar y retroceder de mes y se reutiliza en el resumen, los movimientos, los presupuestos y los informes.

### 10. Servicios

- **ApiService:** operaciones de cuentas, categorías, movimientos, presupuestos, resumen e informes contra la API.
- **AuthService:** registro, inicio y cierre de sesión, y renovación del token de acceso.
- **ThemeService:** cambio entre modo claro y oscuro.
- **authInterceptor y authGuard:** añaden el token a las peticiones, renuevan la sesión cuando caduca y protegen las rutas privadas.
- **LocalApiService, LocalAuthService y LocalThemeService:** sustitutos para el modo local. Mantienen la misma interfaz y guardan los datos en el dispositivo.

## Estructura del proyecto

```
.
├── README.md
├── docker-compose.yml
├── .env.example
├── .vscode/
│   └── settings.json
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Pruebas y compilación en cada push
│       └── android.yml             # Compilación del APK
├── backend/
│   ├── prisma/                     # Esquema y migraciones
│   ├── src/
│   │   ├── config/                 # Validación de variables de entorno
│   │   ├── lib/                    # Cálculo, fechas, estadísticas, tokens y validación
│   │   ├── middleware/             # Autenticación, errores, límites y origen
│   │   ├── routes/                 # auth, accounts, categories, transactions, budgets, stats, reports
│   │   ├── app.ts                  # Configuración de Express
│   │   └── index.ts                # Arranque del servidor
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── native/
    │   └── android/                # Plugin nativo de Descargas (Java)
    ├── scripts/
    │   └── prepare-local.mjs       # Activa el modo local y empaqueta las fuentes
    ├── src/
    │   ├── app/
    │   │   ├── core/               # Servicios, guard, interceptor y modelos
    │   │   │   └── local/          # Datos locales: repositorio, almacén, informes y servicios
    │   │   ├── features/           # auth, layout, dashboard, transactions, accounts,
    │   │   │                       # categories, budgets, reports y settings
    │   │   ├── shared/             # Confirmación, selector de mes y paginador en español
    │   │   ├── app.config.ts       # Configuración principal de Angular
    │   │   └── app.routes.ts       # Rutas de la aplicación
    │   ├── index.html
    │   └── styles.scss             # Estilos globales
    ├── capacitor.config.ts         # Configuración de Capacitor
    ├── Dockerfile
    ├── nginx.conf
    ├── angular.json
    └── package.json
```

## Cómo utilizar la aplicación

1. Inicia la base de datos, la API y la aplicación Angular (o instala el APK).
2. En la versión web, crea una cuenta desde **Registrarse** e inicia sesión.
3. En **Categorías**, pulsa el botón de categorías por defecto o crea las tuyas.
4. En **Cuentas**, crea al menos una cuenta e indica su saldo inicial.
5. En **Movimientos**, pulsa **Nuevo movimiento**, elige el tipo, el importe, la cuenta, la categoría y la fecha, y guarda.
6. Usa los filtros y el paginador para encontrar movimientos.
7. En **Presupuestos**, asigna un límite mensual a una categoría de gasto.
8. En **Resumen**, consulta las tarjetas, las gráficas y la proyección. Cambia de mes con el selector.
9. En **Informes**, descarga el PDF o el Excel del mes.
10. Alterna entre modo claro y oscuro con el botón de la barra superior.
11. En el APK, abre **Ajustes** para exportar una copia de seguridad.

## Persistencia de datos

### Versión web

La aplicación utiliza una API REST propia con PostgreSQL. Todas las consultas se filtran por el usuario autenticado.

| Ruta | Descripción |
| --- | --- |
| `GET /api/health` | Comprobar que la API funciona. |
| `POST /api/auth/register`, `login`, `refresh`, `logout` | Sesión. |
| `PATCH /api/auth/theme` | Guardar el tema del usuario. |
| `GET/POST/PUT/DELETE /api/accounts` | Cuentas. |
| `GET/POST/PUT/DELETE /api/categories` y `POST /api/categories/defaults` | Categorías. |
| `GET/POST/PUT/DELETE /api/transactions` | Movimientos, con filtros `month`, `accountId`, `categoryId`, `page` y `pageSize`. |
| `GET/PUT/DELETE /api/budgets` | Presupuestos por categoría y mes. |
| `GET /api/stats/summary?month=AAAA-MM` | Resumen, gráficas y proyección. |
| `GET /api/reports/pdf` y `/api/reports/excel` | Informes del mes. |

Modelo de datos: `User` → `Account`, `Category`, `Transaction` y `Budget`.

### Versión Android (modo local)

Todos los datos se guardan en un único documento JSON dentro de IndexedDB del dispositivo, con `localStorage` como alternativa si IndexedDB no está disponible. Las escrituras se encolan para que nunca se pisen. Al arrancar, los datos se validan: si el contenido está dañado se guarda una copia aparte antes de empezar con datos nuevos.

## Seguridad

- `helmet`, sin cabecera `X-Powered-By`, límite de tamaño del cuerpo y CORS configurable.
- Contraseñas con `bcrypt` y la misma respuesta para usuario inexistente que para clave incorrecta.
- Validación de entrada con Zod, incluidos los identificadores de las rutas.
- Manejador global de errores que no expone detalles internos.
- Los tokens de acceso y de refresco se distinguen mediante una declaración `typ`.

**Limitación conocida:** el token de refresco es un JWT sin estado. Cerrar sesión borra la cookie, pero el token no se invalida en el servidor hasta que caduca. Para revocarlo habría que guardarlo en la base de datos.

## Validación de requisitos

### A. Funcionalidades esenciales

- **Cuentas:** se pueden crear, editar y eliminar, con saldo calculado.
- **Categorías:** se pueden crear, editar y eliminar; no se elimina una categoría con movimientos.
- **Movimientos:** alta, edición y eliminación con validación de importe, fecha, cuenta, categoría y tipo.
- **Presupuestos:** límite mensual por categoría de gasto, con avisos al 80 % y al 100 %.
- **Resumen:** ingresos, gastos, balance, saldo total, gasto por categoría y últimos 6 meses.
- **Proyección:** gasto estimado a fin de mes y media de los tres meses anteriores.
- **Informes:** PDF y Excel del mes.
- **Sin datos:** se muestran mensajes cuando no hay cuentas, movimientos o presupuestos.

### B. Filtrado y paginación

- **Mes, cuenta y categoría:** filtros combinables en el listado de movimientos.
- **Paginación:** hasta 100 elementos por página, con totales del filtro completo.
- **Orden:** los movimientos aparecen de más reciente a más antiguo.

### C. Persistencia

- **Web:** API REST con Express, Prisma y PostgreSQL.
- **Android:** almacenamiento local en IndexedDB.
- **Operaciones asíncronas:** todas las llamadas se realizan mediante observables de RxJS.
- **Copia de seguridad:** exportación e importación en JSON con validación previa.
- **Feedback:** la interfaz muestra notificaciones de éxito y de error.

## Créditos

Proyecto desarrollado por Santiago Joaquin Cotignola Rodriguez como práctica de Angular, formularios, consumo de una API REST, autenticación, persistencia con PostgreSQL, gráficas, diseño responsive y empaquetado para Android con Capacitor.