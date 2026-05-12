const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method not allowed' };
  }

  try {
    const kbPath = path.join(__dirname, '..', '..', 'knowledge-base.json');
    let documents = [];

    if (fs.existsSync(kbPath)) {
      const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
      documents = kb.documents.map(d => ({
        filename: d.filename,
        type: d.type,
        size: d.size,
        processedAt: d.processedAt,
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ documents }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
}
