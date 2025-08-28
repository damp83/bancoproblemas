# Banco de Problemas — IA (Gemini vía Vercel)

Este proyecto ahora incluye un endpoint serverless para generar problemas con IA usando Google Gemini sin exponer la API key en el cliente.

Estructura relevante:
- api/generate-problem.js — Función serverless (Edge) para Vercel.
- app.js — Botón "Generar Problema con IA" que abre un modal y llama al endpoint.

Despliegue en Vercel:
1) Crea el proyecto en Vercel y conecta este repositorio de GitHub.
2) En Settings → Environment Variables, añade:
   - GEMINI_API_KEY = tu_clave_de_gemini
3) Deploy. Vercel creará el endpoint en /api/generate-problem.

Desarrollo local (opcional):
- Puedes usar `vercel dev` si tienes la CLI de Vercel.
- Asegúrate de configurar GEMINI_API_KEY en tu entorno local (`vercel env pull` o variables de entorno).

Uso:
- En modo Editor, pulsa "✨ Generar Problema con IA".
- Selecciona curso, tipo y (opcional) tema.
- Al generar, se abrirá el formulario con los campos rellenados para que revises y guardes.

Seguridad:
- La clave GEMINI_API_KEY sólo vive en el servidor (función Vercel). El cliente llama al endpoint sin exponer secretos.
