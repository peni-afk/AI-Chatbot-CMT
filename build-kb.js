const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Load knowledge base (built during Netlify build step)
let knowledgeBase = { documents: [] };
const kbPath = path.join(__dirname, '..', '..', 'knowledge-base.json');
try {
  if (fs.existsSync(kbPath)) {
    knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    console.log(`Loaded ${knowledgeBase.documents.length} documents from knowledge base`);
  }
} catch (err) {
  console.error('Error loading knowledge base:', err.message);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages, additionalContext } = JSON.parse(event.body);

    // Build document context - select relevant documents
    // For now, include all documents (they're pre-processed and sized)
    const docSections = knowledgeBase.documents.map(doc => {
      return `\n=== DOKUMENT: ${doc.filename} (${doc.type}) ===\n${doc.content}`;
    }).join('\n\n');

    // Combine with any additional context from user upload in chat
    const fullContext = additionalContext
      ? `${docSections}\n\n=== DODATNI DOKUMENT (uploadao korisnik) ===\n${additionalContext}`
      : docSections;

    const systemPrompt = `Ti si pametan AI asistent za JYSK Western Balkans. Imaš pristup internim dokumentima i podacima tvrtke.

PRAVILA:
- Odgovaraj na jeziku kojim korisnik piše (hrvatski ili engleski)
- Kad koristiš informacije iz dokumenata, navedi iz kojeg dokumenta dolaze
- Za podatke o prodaji (Prometi), analiziraj brojeve, trendove, indekse i daj konkretne uvide
- Za Business Plan, objasni inicijative, odgovorne osobe i rokove
- Budi koncizan ali detaljan
- Ako ne znaš odgovor ili ga nema u dokumentima, reci to iskreno
- Koristi markdown formatiranje za tablice, liste i isticanje
- Za usporedbe koristi tablice
- Indeks > 100 znači rast u odnosu na referentni period, < 100 znači pad

DOSTUPNI DOKUMENTI:
${knowledgeBase.documents.map(d => `- ${d.filename} (${d.type}, ${d.size} znakova)`).join('\n')}

SADRŽAJ DOKUMENATA:
${fullContext}`;

    // Prepare messages for OpenAI
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
    ];

    // Estimate tokens
    const totalChars = systemPrompt.length + messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 3);
    console.log(`Estimated input tokens: ${estimatedTokens}`);

    // Use appropriate model based on context size
    const model = estimatedTokens > 30000 ? 'gpt-4o' : 'gpt-4o-mini';
    console.log(`Using model: ${model}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: data.error.message,
          content: `⚠️ Greška: ${data.error.message}`,
        }),
      };
    }

    const content = data.choices[0].message.content;

    // Extract source references
    const sources = [];
    for (const doc of knowledgeBase.documents) {
      if (content.toLowerCase().includes(doc.filename.toLowerCase()) ||
          content.includes(doc.filename.split('.')[0])) {
        sources.push(doc.filename);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        content,
        sources,
        model,
        tokens: data.usage?.total_tokens || 0,
      }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: err.message,
        content: '⚠️ Došlo je do greške. Pokušaj ponovo.',
      }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
