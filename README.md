# EnergyShark Frontend ⚡🦈

Frontend de **EnergyShark - Grupo 10**, desarrollado como una SPA con React y Vite.

La aplicación permite visualizar el estado energético de la ciudad, consultar ciclos y conectividad, revisar anomalías y gestionar negociaciones voluntarias mediante la API pública de EnergyShark.

## Tecnologías

- React 19
- Vite 8
- JavaScript / JSX
- CSS
- Auth0
- AWS S3
- AWS CloudFront
- AWS API Gateway

El backend y los contratos compartidos se encuentran en repositorios independientes.

---

## Arquitectura general

Distribución del frontend

Usuario
  ↓
https://app.energyshark-g10.tech
  ↓
CloudFront
  ↓
Amazon S3
  ↓
React SPA


Autenticación y API

React SPA
  ↓
Auth0
  ↓
Bearer JWT
  ↓
https://api.energyshark-g10.tech
  ↓
AWS API Gateway
  ↓
JWT Authorizer
  ↓
Backend EnergyShark

El frontend se publica como un build estático en Amazon S3 y se distribuye mediante CloudFront sobre HTTPS.

---

## Estructura del proyecto

```text
src/
├── main.jsx
│   → Monta React.
│   → Configura Auth0Provider.
│   → Carga los estilos globales.
│
├── App.jsx
│   → Layout principal.
│   → Historial de ciclos.
│   → Control de vistas mediante estado React.
│   → Conecta Auth0 con el cliente HTTP.
│
├── components/
│   ├── AuthButton.jsx
│   │   → Login/logout con Auth0.
│   │   → Presentación del usuario autenticado.
│   │
│   ├── CycleDetail.jsx
│   │   → Detalle de un ciclo.
│   │   → Balances de energía y presupuesto.
│   │   → Fondos, demandas, negociaciones y reportes.
│   │   → Ledger de operaciones.
│   │
│   ├── ConnectivityView.jsx
│   │   → Tabla de conectividad.
│   │   → Distancias, costos y disponibilidad.
│   │
│   ├── NegotiationForm.jsx
│   │   → Creación de propuestas give/take.
│   │   → Validación de cantidad y precio.
│   │   → Generación de idpk.
│   │
│   ├── AnomaliesView.jsx
│   │   → Mensajes duplicados, descartados y NACK.
│   │   → Filtros por estado, tipo, idpk y msgId.
│   │
│   └── NegotiationWindowBanner.jsx
│       → Estado de la ventana de negociación.
│       → Cuenta regresiva.
│       → Polling periódico de ciclos.
│
├── services/
│   ├── api.js
│   │   → Cliente HTTP centralizado.
│   │   → URL base de la API.
│   │   → Bearer token.
│   │   → Manejo de errores HTTP.
│   │
│   └── auth.js
│       → Puente entre Auth0 y api.js.
│       → Obtención del access token.
│
├── App.css
├── index.css
└── assets/

public/
├── logoMacquin.png
├── favicon.svg
└── icons.svg

infra/
└── nginx/
    └── frontend.conf
        → Configuración Nginx versionada utilizada durante
          etapas anteriores del despliegue.

.env.example
agents.md
index.html
package.json
package-lock.json
vite.config.js
eslint.config.js
```

---

## Funcionalidades

La aplicación permite:

- Iniciar y cerrar sesión mediante Auth0.
- Consultar el historial de ciclos.
- Consultar el detalle completo de un ciclo.
- Visualizar balances de energía y presupuesto.
- Consultar la tabla de conectividad.
- Crear negociaciones voluntarias.
- Visualizar estados de negociaciones.
- Consultar mensajes anómalos.
- Filtrar anomalías por distintos atributos.
- Visualizar la ventana temporal de negociación.

La navegación se controla actualmente mediante estado React y no utiliza React Router.

---

## API consumida

La aplicación utiliza `VITE_API_URL` como URL base.

En producción:

```text
https://api.energyshark-g10.tech
```

Endpoints utilizados actualmente:

```text
GET  /health
GET  /cycles
GET  /cycles/{cycle_id}
GET  /connectivity
GET  /audit/anomalies
POST /negotiations
```

La API dispone además de operaciones protegidas que pueden ser utilizadas por otros consumidores:

```text
GET /negotiations
GET /negotiations/{negotiation_id}
```

El frontend nunca debe consumir rutas internas del backend.

---

## Variables de entorno

El repositorio contiene `.env.example` como referencia.

Variables utilizadas:

```env
VITE_API_URL=http://localhost:8001

VITE_AUTH0_DOMAIN=dev-rz37e3yw6i3fn2bn.us.auth0.com
VITE_AUTH0_CLIENT_ID=pepHXeaHaTA575ELoPdELGOJ20ZIve3M
VITE_AUTH0_AUDIENCE=https://arquisis-e1-api/
```

Las variables `VITE_*` son incorporadas al bundle del frontend durante el build, por lo que deben considerarse públicas.

---

## Ambiente local

Crear el archivo local a partir del ejemplo:

```bash
cp .env.example .env
```

El valor local esperado para la API es:

```env
VITE_API_URL=http://localhost:8001
```

El backend debe estar levantado de forma independiente.

Instalar dependencias:

```bash
npm ci
```

Ejecutar el frontend:

```bash
npm run dev
```

Por defecto Vite entrega una URL similar a:

```text
http://localhost:5173
```

El origen local debe estar autorizado tanto en Auth0 como en la configuración CORS utilizada durante desarrollo.

---

## Scripts disponibles

### Desarrollo

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Build productivo

```bash
npm run build
```

El resultado se genera en:

```text
dist/
```

### Preview del build

```bash
npm run preview
```

Actualmente este repositorio no posee una suite automatizada de tests frontend.

---

## Auth0

La SPA utiliza Auth0 para autenticación.

El flujo es:

```text
Usuario
  ↓
loginWithRedirect()
  ↓
Auth0
  ↓
Frontend
  ↓
getAccessTokenSilently()
  ↓
Bearer JWT
  ↓
API Gateway
```

El `Auth0Provider` se configura mediante:

```text
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_AUTH0_AUDIENCE
```

El audience utilizado por EnergyShark es:

```text
https://arquisis-e1-api/
```

Cuando existe un token, el cliente HTTP agrega:

```http
Authorization: Bearer <access_token>
```

a las requests correspondientes.

---

## Configuración Auth0 en producción

La aplicación Auth0 utilizada por el frontend es una SPA.

El origen productivo principal del frontend es:

```text
https://app.energyshark-g10.tech
```

Este dominio debe estar autorizado en Auth0 en:

```text
Allowed Callback URLs
Allowed Logout URLs
Allowed Web Origins
```

Durante la transición también puede mantenerse autorizado el dominio original de CloudFront:

```text
https://d9yjiq237jfab.cloudfront.net
```

Para desarrollo local también se utiliza:

```text
http://localhost:5173
```

El flujo esperado es:

```text
Usuario
  ↓
https://app.energyshark-g10.tech
  ↓
loginWithRedirect()
  ↓
Auth0
  ↓
https://app.energyshark-g10.tech
  ↓
getAccessTokenSilently()
  ↓
Bearer JWT
  ↓
https://api.energyshark-g10.tech
```

El audience utilizado por EnergyShark continúa siendo:

```text
https://arquisis-e1-api/
```

El cambio de dominio del frontend no requiere cambiar:

- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- el issuer de Auth0
- el JWT Authorizer de API Gateway

No deben almacenarse tokens, client secrets ni otras credenciales directamente en el repositorio.

## Build de producción

Para realizar un build productivo debe contener:

```env
VITE_API_URL=https://api.energyshark-g10.tech
VITE_AUTH0_DOMAIN=dev-rz37e3yw6i3fn2bn.us.auth0.com
VITE_AUTH0_CLIENT_ID=pepHXeaHaTA575ELoPdELGOJ20ZIve3M
VITE_AUTH0_AUDIENCE=https://arquisis-e1-api/
```

Luego:

```bash
rm -rf dist
npm run build
```

Es posible comprobar que la URL correcta quedó incorporada al bundle buscando:

```bash
grep -R "api.energyshark-g10.tech" dist/
```

---

## Despliegue productivo

El frontend productivo utiliza:

```text
Vite build
   ↓
Amazon S3
   ↓
CloudFront
   ↓
HTTPS
```

### Amazon S3

Bucket:

```text
energyshark-g10-frontend
```

La carpeta `dist/` se publica en la raíz del bucket.

El bucket se utiliza como origen privado de CloudFront.

---

## CloudFront

Distribución:

```text
Distribution ID:
EFUBNHG9ZB6SV

Dominio CloudFront:
https://d9yjiq237jfab.cloudfront.net

Dominio personalizado:
https://app.energyshark-g10.tech
```

CloudFront utiliza el endpoint REST de S3 como origen.

Configuraciones relevantes:

```text
Default root object:
index.html

Viewer protocol policy:
Redirect HTTP to HTTPS

Allowed methods:
GET, HEAD
```

Para soportar la SPA se configuran respuestas personalizadas:

```text
403
→ /index.html
→ HTTP 200

404
→ /index.html
→ HTTP 200
```

Esto permite que rutas manejadas por la SPA puedan terminar sirviendo `index.html`.

---

## Despliegue manual a AWS

Desde la raíz del repositorio:

```bash
npm run build
```

Sincronizar el build con S3:

```bash
aws s3 sync dist/ \
  s3://energyshark-g10-frontend \
  --delete
```

Luego invalidar la caché de CloudFront:

```bash
aws cloudfront create-invalidation \
  --distribution-id EFUBNHG9ZB6SV \
  --paths "/*"
```

La invalidación puede revisarse mediante:

```bash
aws cloudfront list-invalidations \
  --distribution-id EFUBNHG9ZB6SV
```

Después de propagarse la invalidación, la nueva versión estará disponible en:

```text
https://d9yjiq237jfab.cloudfront.net
```

---

## API Gateway y CORS

El frontend no se comunica directamente con la IP de EC2.

Las requests productivas utilizan:

```text
https://api.energyshark-g10.tech
```

Este dominio apunta a AWS API Gateway.

API Gateway tiene CORS configurado para aceptar el origen CloudFront utilizado por la SPA.

Métodos utilizados:

```text
GET
POST
OPTIONS
```

Headers relevantes:

```text
Authorization
Content-Type
```

Una operación autenticada puede generar el siguiente flujo:

```text
OPTIONS /negotiations
→ 204

POST /negotiations
→ JWT Authorizer
→ backend
```

Durante la validación end-to-end se comprobó que una propuesta autenticada alcanzara el backend y recibiera una respuesta de negocio `422` por un ciclo expirado.

Ese `422` demuestra que la request superó CORS y autenticación y llegó a la lógica de negocio.

---

## Flujo end-to-end comprobado

El flujo productivo comprobado es:

```text
Usuario
  ↓
https://d9yjiq237jfab.cloudfront.net
  ↓
React SPA
  ↓
Auth0
  ↓
Bearer JWT
  ↓
https://api.energyshark-g10.tech
  ↓
AWS API Gateway
  ↓
JWT Authorizer
  ↓
Backend EnergyShark
  ↓
PostgreSQL
```

Se verificaron desde el frontend desplegado requests como:

```text
GET /cycles → 200

GET /cycles/{cycle_id} → 200

OPTIONS /negotiations → 204

POST /negotiations
→ request autenticada
→ respuesta de negocio del backend
```

---

## Configuración Nginx versionada

El repositorio mantiene:

```text
infra/nginx/frontend.conf
```

Este archivo corresponde a la configuración Nginx utilizada durante etapas anteriores del despliegue y sirve como referencia de infraestructura.

Incluye:

- Servicio de la SPA.
- HTTPS.
- Fallback a `index.html`.
- Proxy `/api/`.
- Bloqueo de rutas internas.

El flujo productivo actual del frontend utiliza:

```text
S3
→ CloudFront
```

y la API pública se consume mediante:

```text
https://api.energyshark-g10.tech
```

---

## Verificación del despliegue

### Frontend disponible

Abrir:

```text
https://d9yjiq237jfab.cloudfront.net
```

### API correcta

En DevTools → Network, las requests deberían apuntar a:

```text
api.energyshark-g10.tech
```

y no directamente a EC2.

### Ciclos

Debe observarse:

```text
GET /cycles → 200
```

### Auth0

El login debe retornar correctamente a la distribución CloudFront.

### Operación protegida

Al crear una negociación autenticada:

```text
OPTIONS /negotiations → 204
POST /negotiations → respuesta del backend
```

Un `401` indicaría un problema de autenticación.

Un `4xx` de validación o regla de negocio posterior al authorizer demuestra que la request alcanzó el backend.

---

## Repositorios relacionados

### Backend

```text
https://github.com/coniverav/E0-Arquisis-local
```

Responsable de:

- API FastAPI.
- PostgreSQL.
- RabbitMQ.
- Ledger.
- Ciclos.
- Negociaciones.
- AWS EC2/ECR.
- New Relic.

### Contracts

```text
https://github.com/VicenteIgnacioSotoGonzalez/Arquisis-G10-Contracts
```

Fuente de verdad para:

- JSON Schemas del protocolo.
- Contratos de mensajes.
- OpenAPI de la API pública.
- Contexto compartido del proyecto.

---