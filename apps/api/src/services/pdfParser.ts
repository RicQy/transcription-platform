import pdfParse from 'pdf-parse';
import fs from 'fs';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPdf {
  text: string;
  pages: ParsedPage[];
}

export async function parsePdf(filePath: string): Promise<ParsedPdf> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  // pdf-parse gives us full text; split by form-feed for page approximation
  const rawPages = data.text.split('\f');
  const pages: ParsedPage[] = rawPages.map((pageText, idx) => ({
    pageNumber: idx + 1,
    text: pageText.trim(),
  }));

  return { text: data.text, pages };
}
