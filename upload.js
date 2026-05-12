const busboy = require('busboy');
const XLSX = require('xlsx');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const result = await parseMultipart(event);

    if (!result.file) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    const { filename, buffer } = result.file;
    const ext = filename.split('.').pop().toLowerCase();
    let content = '';

    switch (ext) {
      case 'txt':
      case 'md':
        content = buffer.toString('utf-8');
        break;

      case 'csv':
        content = buffer.toString('utf-8');
        break;

      case 'xlsx':
      case 'xls':
        content = parseExcel(buffer);
        break;

      default:
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: `Format .${ext} nije podržan za upload u chatu. Podržani: .xlsx, .csv, .txt` }),
        };
    }

    // Limit size
    const maxChars = 50000;
    if (content.length > maxChars) {
      content = content.substring(0, maxChars) + '\n\n[... skraćeno ...]';
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        filename,
        content,
        characters: content.length,
      }),
    };

  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Greška: ' + err.message }),
    };
  }
};

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let output = '';

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.startsWith('_')) continue;
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length === 0) continue;

    output += `\n## Sheet: ${sheetName}\n`;
    const headers = data[0];
    output += '| ' + headers.join(' | ') + ' |\n';
    output += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    for (let i = 1; i < Math.min(data.length, 200); i++) {
      const row = data[i];
      output += '| ' + headers.map((_, j) => row[j] !== undefined ? String(row[j]).substring(0, 40) : '').join(' | ') + ' |\n';
    }
    if (data.length > 200) {
      output += `\n... i još ${data.length - 200} redova\n`;
    }
  }
  return output;
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    const bb = busboy({ headers: { 'content-type': contentType } });
    const result = {};

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        result.file = { filename: info.filename, buffer: Buffer.concat(chunks) };
      });
    });

    bb.on('finish', () => resolve(result));
    bb.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);
    bb.end(body);
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
