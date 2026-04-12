import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, Header } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

interface ExportOptions {
  filename: string;
  title?: string;
  jurisdiction?: string;
  transcriptId: string;
}

interface BatchExportItem {
  text: string;
  options: ExportOptions;
}

export class ExportService {
  static async toPDF(text: string, options: ExportOptions) {
    const doc = new jsPDF() as any;
    const lines = text.split('\n');
    let currentY = 40;
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;
    const lineHeight = 7;
    let lineInPage = 1;

    // Header
    doc.setFontSize(14);
    doc.text(options.jurisdiction || 'LEGAL TRANSCRIPT', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(options.title || '', 105, 22, { align: 'center' });
    doc.text(`ID: ${options.transcriptId}`, 105, 27, { align: 'center' });
    
    doc.setDrawColor(0);
    doc.line(margin, 30, 210 - margin, 30);

    // Content with line numbers
    doc.setFont('Courier', 'normal');
    doc.setFontSize(11);

    for (let i = 0; i < lines.length; i++) {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
        lineInPage = 1;
      }

      // Line number
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(lineInPage.toString(), 10, currentY);
      doc.setTextColor(0);
      doc.setFontSize(11);

      // Wrap text
      const wrappedText = doc.splitTextToSize(lines[i], 160);
      doc.text(wrappedText, margin + 5, currentY);
      
      const linesUsed = wrappedText.length;
      currentY += lineHeight * linesUsed;
      lineInPage += linesUsed;

      if (lineInPage > 25) {
        // Legal convention often has 25 lines per page, but for simplicity we allow wrapping.
        // We'll keep lineInPage incrementing but it shows on the left.
      }
    }

    doc.save(`${options.filename}.pdf`);
  }

  static async getPDFBlob(text: string, options: ExportOptions): Promise<Blob> {
    const doc = new jsPDF() as any;
    const lines = text.split('\n');
    let currentY = 40;
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;
    const lineHeight = 7;
    let lineInPage = 1;

    doc.setFontSize(14);
    doc.text(options.jurisdiction || 'LEGAL TRANSCRIPT', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(options.title || '', 105, 22, { align: 'center' });
    doc.text(`ID: ${options.transcriptId}`, 105, 27, { align: 'center' });
    doc.line(margin, 30, 210 - margin, 30);
    doc.setFont('Courier', 'normal');
    doc.setFontSize(11);

    for (let i = 0; i < lines.length; i++) {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
        lineInPage = 1;
      }
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(lineInPage.toString(), 10, currentY);
      doc.setTextColor(0);
      doc.setFontSize(11);
      const wrappedText = doc.splitTextToSize(lines[i], 160);
      doc.text(wrappedText, margin + 5, currentY);
      const linesUsed = wrappedText.length;
      currentY += lineHeight * linesUsed;
      lineInPage += linesUsed;
    }

    return doc.output('blob');
  }

  static async getDOCXBlob(text: string, options: ExportOptions): Promise<Blob> {
    const lines = text.split('\n').map(l => {
      return new Paragraph({
        children: [
          new TextRun({
            text: l,
            font: "Courier New",
            size: 24, // 12pt
          }),
        ],
        spacing: { line: 480 }, // double spaced
      });
    });

    const doc = new Document({
      sections: [{
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: options.jurisdiction || 'LEGAL TRANSCRIPT', bold: true }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: lines,
      }],
    });

    return await Packer.toBlob(doc);
  }

  static async toZIP(items: BatchExportItem[], format: 'PDF' | 'DOCX') {
    const zip = new JSZip();
    const folder = zip.folder("transcripts");
    
    for (const item of items) {
      if (format === 'PDF') {
        const blob = await this.getPDFBlob(item.text, item.options);
        folder?.file(`${item.options.filename}.pdf`, blob);
      } else {
        const blob = await this.getDOCXBlob(item.text, item.options);
        folder?.file(`${item.options.filename}.docx`, blob);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Batch_Export_${new Date().toISOString().split('T')[0]}.zip`);
  }

  static async toDOCX(text: string, options: ExportOptions) {
    const lines = text.split('\n').map(l => {
      return new Paragraph({
        children: [
          new TextRun({
            text: l,
            font: "Courier New",
            size: 24, // 12pt
          }),
        ],
        spacing: { line: 480 }, // double spaced
      });
    });

    const doc = new Document({
      sections: [{
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: options.jurisdiction || 'LEGAL TRANSCRIPT', bold: true }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: lines,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${options.filename}.docx`);
  }
}
