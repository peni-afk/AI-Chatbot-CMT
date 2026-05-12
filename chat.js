const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages, documents } = JSON.parse(event.body);

    // Build system prompt with document context
    let systemPrompt = `Ti si pametan AI asistent koji pomaže korisnicima analizirati dokumente i podatke. 

PRAVILA:
- Odgovaraj na jeziku kojim korisnik piše (hrvatski ili engleski)
- Kad koristiš informacije iz dokumenata, navedi iz kojeg dokumenta dolaze
- Za Excel/CSV podatke, analiziraj brojeve, trendove i daj konkretne uvide
- Budi koncizan ali detaljan
- Ako ne znaš odgovor ili ga nema u dokumentima, reci to iskreno
- Koristi markdown formatiranje za tablice, liste i isticanje
- Za usporedbe koristi tablice`;

    if (documents && documents.trim()) {
      systemPrompt += `

DOKUMENTI KORISNIKA (koristi ove podatke za odgovore):
---
${documents}
---

Kad odgovaraš na temelju dokumenata, na kraju odgovora navedi izvore u formatu:
📄 Izvor: [ime dokumenta]`;
    }

    // Prepare messages for OpenAI
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    const content = data.choices[0].message.content;

    // Extract source references from content
    const sources = [];
    const sourceRegex = /📄\s*Izvor:\s*(.+)/g;
    let match;
    while ((match = sourceRegex.exec(content)) !== null) {
      sources.push(match[1].trim());
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        content,
        sources,
        tokens: data.usage?.total_tokens || 0,
      }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
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
