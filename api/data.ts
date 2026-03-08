import type { VercelRequest, VercelResponse } from '@vercel/node';
import csv from 'csv-parser';
import { Readable } from 'stream';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-occMsYGW9OWfFdVvQgDHUND2DPk0EEYwqgLQLqfQZ2l5ZzCQAFv-KXI4jpwDrhhNo-ytteaTxjuv/pub?gid=0&single=true&output=csv';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const records: Record<string, string>[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from([text])
        .pipe(csv())
        .on('data', (row) => records.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json(records);
  } catch (err) {
    console.error('CSV fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch energy data' });
  }
}
