import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Papa from "papaparse";
import { parse, format, isValid, getDay } from "date-fns";

const app = express();
const PORT = 3000;

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/14ebIL4Ffr_X6_sqNrvEmv93uEWPDb42dMuBuN6o48c0/export?format=csv&gid=0";

interface FlightData {
  route: string;
  availability: {
    date: string;
    dayOfWeek: string;
    count: number;
    tax: number;
    isRecorded: boolean; // New field to track if the data was actually fetched/entered
  }[];
}

// Normalization Rules
const TARGET_TAXES: Record<string, number> = {
  "AEP-ASU": 106000, "ASU-AEP": 56000,
  "AEP-LIM": 127000, "LIM-AEP": 41000,
  "AEP-GIG": 106000, "GIG-AEP": 16000,
  "AEP-SCL": 106000, "SCL-AEP": 34000,
  "AEP-REC": 105000, "REC-AEP": 27000,
  "USH-AEP": 16000, "USH-EZE": 16000, "AEP-USH": 16000, "EZE-USH": 16000,
  "NQN-AEP": 10000, "NQN-EZE": 10000, "AEP-NQN": 10000, "EZE-NQN": 10000,
  "CPC-AEP": 4000, "AEP-CPC": 4000,
};

const DEFAULT_NATIONAL_TAX = 7100;

function normalizeTax(route: string, currentTax: number): number {
  const target = TARGET_TAXES[route] || DEFAULT_NATIONAL_TAX;
  const tolerance = 0.2; // 20%
  const diff = Math.abs(currentTax - target);
  if (diff / target > tolerance) {
    return target;
  }
  return currentTax;
}

function parseCell(value: string, route: string): { count: number; tax: number; isRecorded: boolean } {
  const cleanValue = value?.trim().toUpperCase();
  
  if (!cleanValue || cleanValue === "") {
    return { count: 0, tax: 0, isRecorded: false };
  }

  if (cleanValue === "-") {
    return { count: 0, tax: 0, isRecorded: true };
  }

  let count = 1;
  let tax = 0;

  if (cleanValue === "ERR-BTN") {
    count = 1;
    tax = 7100;
  } else if (cleanValue.includes("-")) {
    const parts = cleanValue.split("-");
    count = parseInt(parts[0]) || 1;
    tax = parseInt(parts[1]) || 0;
  } else {
    tax = parseInt(cleanValue) || 0;
  }

  if (tax > 0) {
    tax = normalizeTax(route, tax);
  }

  return { count, tax, isRecorded: true };
}

async function fetchAndProcessData() {
  const response = await axios.get(SHEET_CSV_URL);
  const results = Papa.parse(response.data, { header: false });
  const rows = results.data as string[][];

  if (rows.length < 1) return [];

  const headers = rows[0];
  const dateColumns: { index: number; date: string; dayOfWeek: string }[] = [];

  // Identify date columns (skip first column)
  for (let i = 1; i < headers.length; i++) {
    const dateStr = headers[i]?.trim();
    if (dateStr) {
      const parsedDate = parse(dateStr, "dd.MM.yyyy", new Date());
      if (isValid(parsedDate)) {
        dateColumns.push({
          index: i,
          date: format(parsedDate, "yyyy-MM-dd"),
          dayOfWeek: format(parsedDate, "EEEE"),
        });
      }
    }
  }

  const flightData: FlightData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const route = row[0]?.trim();
    if (!route || route === "") continue;

    const availability = dateColumns.map(col => {
      const cellValue = row[col.index];
      const parsed = parseCell(cellValue, route);
      return {
        date: col.date,
        dayOfWeek: col.dayOfWeek,
        count: parsed.count,
        tax: parsed.tax,
        isRecorded: parsed.isRecorded
      };
    });

    flightData.push({ route, availability });
  }

  return flightData;
}

async function startServer() {
  // API routes
  app.get("/api/flights", async (req, res) => {
    try {
      const data = await fetchAndProcessData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      res.status(500).json({ error: "Failed to fetch data from Google Sheets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
