# AI Chatbot 🤖

AI chatbot s podrškom za dokumente (PDF, DOCX, XLSX, CSV, TXT). Uploadaj datoteke i postavljaj pitanja — AI analizira sadržaj i daje odgovore s izvorima.

## Značajke

- 💬 ChatGPT-stil sučelje
- 📄 Upload PDF, Word, Excel, CSV, TXT datoteka
- 📊 Analiza Excel tablica s automatskom statistikom
- 🌍 Radi na hrvatskom i engleskom
- 🔒 API ključ siguran na serveru (Netlify Functions)
- 📱 Responzivan dizajn (desktop + mobitel)

## Setup

1. Napravi račun na [platform.openai.com](https://platform.openai.com)
2. Generiraj API ključ
3. Deplojaj na Netlify:
   - Spoji ovaj repo na [app.netlify.com](https://app.netlify.com)
   - U **Site settings → Environment variables** dodaj:
     - `OPENAI_API_KEY` = tvoj ključ
4. Gotovo!

## Struktura projekta

```
├── index.html                    # Frontend (chat sučelje)
├── netlify.toml                  # Netlify konfiguracija
├── package.json                  # Node.js dependencies
└── netlify/functions/
    ├── chat.js                   # AI chat endpoint
    └── upload.js                 # File upload + parsing
```

## Tehnologije

- **Frontend:** Vanilla HTML/CSS/JS
- **Backend:** Netlify Functions (serverless)
- **AI:** OpenAI GPT-4o
- **Parseri:** pdf-parse, mammoth (DOCX), xlsx
