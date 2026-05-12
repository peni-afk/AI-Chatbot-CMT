const busboy = require('busboy');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
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
        content = buffer.toString('utf-8');
        break;

      case 'csv':
        content = parseCSV(buffer.toString('utf-8'));
        break;

      case 'pdf':
        const pdfData = await pdf(buffer);
        content = pdfData.text;
        break;

      case 'docx':
        const docResult = await mammoth.extractRawText({ buffer });
        content = docResult.value;
        break;

      case 'xlsx':
        content = parseExcel(buffer);
        break;

      default:
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: `Nepodržani format: .${ext}` }),
        };
    }

    // Trim content to reasonable size (OpenAI context limit)
    const maxChars = 80000;
    if (content.length > maxChars) {
      content = content.substring(0, maxChars) + '\n\n[... dokument skraćen zbog veličine ...]';
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        filename,
        content,
        characters: content.length,
        chunks: Math.ceil(content.length / 2000),
      }),
    };

  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Greška pri procesiranju datoteke: ' + err.message }),
    };
  }
};

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let output = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) continue;

    output += `\n## Sheet: ${sheetName}\n`;

    // Headers
    const headers = data[0];
    output += '| ' + headers.join(' | ') + ' |\n';
    output += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    // Rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      output += '| ' + headers.map((_, j) => row[j] !== undefined ? String(row[j]) : '').join(' | ') + ' |\n';
    }

    // Basic stats for numeric columns
    output += '\n### Statistika:\n';
    headers.forEach((header, j) => {
      const values = data.slice(1).map(row => row[j]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        output += `- **${header}**: min=${min}, max=${max}, prosjek=${avg.toFixed(2)}, ukupno=${sum.toFixed(2)}\n`;
      }
    });
  }

  return output;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return '';

  let output = '## CSV podaci\n\n';
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  output += '| ' + headers.join(' | ') + ' |\n';
  output += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    output += '| ' + cols.join(' | ') + ' |\n';
  }

  return output;
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];

    const bb = busboy({ headers: { 'content-type': contentType } });
    const result = {};
    const fileBuffers = [];

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        result.file = {
          filename: info.filename,
          buffer: Buffer.concat(chunks),
        };
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
