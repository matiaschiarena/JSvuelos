import Papa from 'papaparse';
import { parse, format, isValid } from 'date-fns';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/14ebIL4Ffr_X6_sqNrvEmv93uEWPDb42dMuBuN6o48c0/export?format=csv&gid=0';
const TARGET_TAXES = {
  'AEP-ASU': 106000, 'ASU-AEP': 56000,
  'AEP-LIM': 127000, 'LIM-AEP': 41000,
  'AEP-GIG': 106000, 'GIG-AEP': 16000,
  'AEP-SCL': 106000, 'SCL-AEP': 34000,
  'AEP-REC': 105000, 'REC-AEP': 27000,
  'USH-AEP': 16000, 'USH-EZE': 16000, 'AEP-USH': 16000, 'EZE-USH': 16000,
  'NQN-AEP': 10000, 'NQN-EZE': 10000, 'AEP-NQN': 10000, 'EZE-NQN': 10000,
  'CPC-AEP': 4000, 'AEP-CPC': 4000,
};
const DEFAULT_NATIONAL_TAX = 7100;
function normalizeTax(route, currentTax) {
  const target = TARGET_TAXES[route] || DEFAULT_NATIONAL_TAX;
  return Math.abs(currentTax - target) / target > 0.2 ? target : currentTax;
}
function parseCell(value, route) {
  const cleanValue = value?.trim().toUpperCase();
  if (!cleanValue) return { count: 0, tax: 0, isRecorded: false };
  if (cleanValue === '-') return { count: 0, tax: 0, isRecorded: true };
  let count = 1; let tax = 0;
  if (cleanValue === 'ERR-BTN') tax = 7100;
  else if (cleanValue.includes('-')) {
    const parts = cleanValue.split('-');
    count = parseInt(parts[0], 10) || 1;
    tax = parseInt(parts[1], 10) || 0;
  } else tax = parseInt(cleanValue, 10) || 0;
  if (tax > 0) tax = normalizeTax(route, tax);
  return { count, tax, isRecorded: true };
}
async function fetchAndProcessData() {
  const response = await fetch(SHEET_CSV_URL, { headers: { accept: 'text/csv,text/plain,*/*' } });
  if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}`);
  const csv = await response.text();
  const rows = Papa.parse(csv, { header: false }).data;
  if (!rows.length) return [];
  const headers = rows[0] || [];
  const dateColumns = [];
  for (let i = 1; i < headers.length; i++) {
    const dateStr = headers[i]?.trim();
    if (!dateStr) continue;
    const parsedDate = parse(dateStr, 'dd.MM.yyyy', new Date());
    if (isValid(parsedDate)) dateColumns.push({ index: i, date: format(parsedDate, 'yyyy-MM-dd'), dayOfWeek: format(parsedDate, 'EEEE') });
  }
  const flightData = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const route = row[0]?.trim();
    if (!route) continue;
    const availability = dateColumns.map(col => {
      const parsed = parseCell(row[col.index], route);
      return { date: col.date, dayOfWeek: col.dayOfWeek, count: parsed.count, tax: parsed.tax, isRecorded: parsed.isRecorded };
    });
    flightData.push({ route, availability });
  }
  return flightData;
}
export async function handler() {
  try {
    const data = await fetchAndProcessData();
    return { statusCode: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' }, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch data from Google Sheets' }) };
  }
}
