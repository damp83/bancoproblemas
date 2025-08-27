OpenDyslexic fonts are not included in this repository by default for licensing and size reasons.

If you want the app to use the fonts locally (recommended for offline use and performance), place the following files in this `fonts/` folder:

   - OpenDyslexic-Regular.woff  (or OpenDyslexic-Regular.woff2)
   - OpenDyslexic-Bold.woff     (or OpenDyslexic-Bold.woff2)

Trusted CDN locations (copy a browser URL and download manually):

   https://cdn.jsdelivr.net/npm/open-dyslexic@latest/woff/OpenDyslexic-Regular.woff
   https://cdn.jsdelivr.net/npm/open-dyslexic@latest/woff/OpenDyslexic-Bold.woff

PowerShell one-liner (run in a PowerShell window) to download both files into this folder:

   $out = 'C:\\Users\\diego\\Desktop\\app problemas\\fonts';\
   Invoke-WebRequest 'https://cdn.jsdelivr.net/npm/open-dyslexic@latest/woff/OpenDyslexic-Regular.woff' -OutFile (Join-Path $out 'OpenDyslexic-Regular.woff');\
   Invoke-WebRequest 'https://cdn.jsdelivr.net/npm/open-dyslexic@latest/woff/OpenDyslexic-Bold.woff' -OutFile (Join-Path $out 'OpenDyslexic-Bold.woff')

Notes:
- After adding the files, the app will prefer local WOFF2/WOFF files when 'Fuente disléxica' is enabled in the accessibility panel.
- If you prefer to load from the CDN at runtime instead, the app already supports injecting the CDN stylesheet automatically when you enable the dyslexic font and a local font is not found.

If you want me to add the binary font files into the repository directly, confirm and I'll download and commit them (this will increase the repo size).
