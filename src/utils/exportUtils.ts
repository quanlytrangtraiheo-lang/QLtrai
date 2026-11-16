import { jsPDF } from 'jspdf';

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (cell: string | number): string => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface PdfReportSection {
  heading: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

/**
 * Renders crisp high-DPI Vietnamese-safe PDF pages via offscreen Canvas + jsPDF
 * so all Vietnamese diacritics render reliably offline without external font bundles.
 */
export function exportReportToPDF(
  filename: string,
  farmName: string,
  reportTitle: string,
  subtitle: string,
  summaryCards: Array<{ label: string; value: string }>,
  sections: PdfReportSection[]
): void {
  const pageW = 1240;
  const pageH = 1754; // A4 @ 150dpi
  const margin = 64;
  const contentW = pageW - margin * 2;
  const fontFamily = getComputedStyle(document.documentElement).fontFamily || 'sans-serif';

  const pages: HTMLCanvasElement[] = [];
  let canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  let ctx = canvas.getContext('2d')!;

  const initPage = () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);
    // Subtle top accent line
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, pageW, 10);
  };

  const newPage = () => {
    pages.push(canvas);
    canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    ctx = canvas.getContext('2d')!;
    initPage();
    return 72;
  };

  initPage();
  let y = 74;

  // Header
  ctx.fillStyle = '#15803D';
  ctx.font = `700 18px ${fontFamily}`;
  ctx.fillText(farmName.toUpperCase(), margin, y);
  y += 36;

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 32px ${fontFamily}`;
  ctx.fillText(reportTitle, margin, y);
  y += 30;

  ctx.fillStyle = '#475569';
  ctx.font = `400 18px ${fontFamily}`;
  ctx.fillText(subtitle, margin, y);
  y += 28;

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(pageW - margin, y);
  ctx.stroke();
  y += 28;

  // Summary KPI Row
  if (summaryCards.length > 0) {
    const cols = Math.min(summaryCards.length, 4);
    const gap = 16;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    summaryCards.slice(0, 4).forEach((card, i) => {
      const cx = margin + i * (cardW + gap);
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx, y, cardW, 86);
      ctx.strokeRect(cx, y, cardW, 86);

      ctx.fillStyle = '#64748B';
      ctx.font = `500 15px ${fontFamily}`;
      ctx.fillText(card.label, cx + 16, y + 30);

      ctx.fillStyle = '#0F172A';
      ctx.font = `700 22px ${fontFamily}`;
      ctx.fillText(card.value, cx + 16, y + 64);
    });
    y += 118;
  }

  // Sections
  for (const sec of sections) {
    if (y > pageH - 220) y = newPage();

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 22px ${fontFamily}`;
    ctx.fillText(sec.heading, margin, y);
    y += 20;

    const colCount = Math.max(sec.headers.length, 1);
    const colW = contentW / colCount;
    const rowH = 38;

    // Table header
    ctx.fillStyle = '#15803D';
    ctx.fillRect(margin, y, contentW, rowH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 15px ${fontFamily}`;
    sec.headers.forEach((h, idx) => {
      ctx.fillText(String(h).slice(0, 26), margin + idx * colW + 10, y + 24);
    });
    y += rowH;

    if (sec.rows.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = `400 15px ${fontFamily}`;
      ctx.fillText('Chưa có dữ liệu trong kỳ báo cáo.', margin + 10, y + 24);
      y += rowH + 24;
      continue;
    }

    sec.rows.forEach((row, rIdx) => {
      if (y > pageH - 96) {
        y = newPage();
        ctx.fillStyle = '#15803D';
        ctx.fillRect(margin, y, contentW, rowH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 15px ${fontFamily}`;
        sec.headers.forEach((h, idx) => {
          ctx.fillText(String(h).slice(0, 26), margin + idx * colW + 10, y + 24);
        });
        y += rowH;
      }

      ctx.fillStyle = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(margin, y, contentW, rowH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, contentW, rowH);

      ctx.fillStyle = '#1E293B';
      ctx.font = `400 15px ${fontFamily}`;
      row.forEach((cell, idx) => {
        const text = String(cell ?? '—');
        const maxChars = Math.max(10, Math.floor(colW / 9));
        const clipped = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
        ctx.fillText(clipped, margin + idx * colW + 10, y + 24);
      });
      y += rowH;
    });

    y += 36;
  }

  pages.push(canvas);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  pages.forEach((pg, index) => {
    if (index > 0) pdf.addPage();
    // Footer page number
    const pCtx = pg.getContext('2d')!;
    pCtx.fillStyle = '#94A3B8';
    pCtx.font = `400 14px ${fontFamily}`;
    pCtx.fillText(
      `TrạiHeo · Trang ${index + 1}/${pages.length} · Xuất lúc ${new Date().toLocaleString('vi-VN')}`,
      margin,
      pageH - 32
    );
    const imgData = pg.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
  });

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
