/**
 * Certificate PDF generation using pdf-lib.
 * Generates a simple, clean A4 landscape certificate.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface CertificateOptions {
  certId: string;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
}

export async function generateCertificatePdf(opts: CertificateOptions): Promise<Uint8Array> {
  const { certId, studentName, courseTitle, issuedAt } = opts;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // Background: deep navy
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.06, 0.09, 0.22)
  });

  // Gold border
  const borderPadding = 20;
  page.drawRectangle({
    x: borderPadding,
    y: borderPadding,
    width: width - borderPadding * 2,
    height: height - borderPadding * 2,
    borderColor: rgb(0.92, 0.78, 0.34),
    borderWidth: 2
  });

  // LearnHub wordmark
  page.drawText("LearnHub", {
    x: width / 2 - 80,
    y: height - 90,
    size: 28,
    font: boldFont,
    color: rgb(0.92, 0.78, 0.34)
  });

  // Title
  page.drawText("Certificate of Completion", {
    x: width / 2 - 165,
    y: height - 140,
    size: 24,
    font: regularFont,
    color: rgb(0.85, 0.85, 0.95)
  });

  // "This certifies that"
  page.drawText("This certifies that", {
    x: width / 2 - 70,
    y: height - 210,
    size: 14,
    font: regularFont,
    color: rgb(0.7, 0.7, 0.85)
  });

  // Student name
  const nameWidth = boldFont.widthOfTextAtSize(studentName, 36);
  page.drawText(studentName, {
    x: width / 2 - nameWidth / 2,
    y: height - 265,
    size: 36,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  // Divider line under name
  page.drawLine({
    start: { x: width / 2 - 200, y: height - 280 },
    end: { x: width / 2 + 200, y: height - 280 },
    thickness: 1,
    color: rgb(0.92, 0.78, 0.34)
  });

  // "has successfully completed"
  page.drawText("has successfully completed", {
    x: width / 2 - 100,
    y: height - 320,
    size: 14,
    font: regularFont,
    color: rgb(0.7, 0.7, 0.85)
  });

  // Course title
  const courseFontSize = courseTitle.length > 50 ? 18 : 22;
  const courseTitleWidth = boldFont.widthOfTextAtSize(courseTitle, courseFontSize);
  page.drawText(courseTitle, {
    x: width / 2 - courseTitleWidth / 2,
    y: height - 365,
    size: courseFontSize,
    font: boldFont,
    color: rgb(0.92, 0.78, 0.34)
  });

  // Issued date
  const issuedDate = new Date(issuedAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  page.drawText(`Issued on ${issuedDate}`, {
    x: width / 2 - 80,
    y: height - 430,
    size: 12,
    font: regularFont,
    color: rgb(0.6, 0.6, 0.75)
  });

  // Certificate ID (for verification)
  page.drawText(`Certificate ID: ${certId}`, {
    x: 50,
    y: 45,
    size: 9,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.65)
  });

  // Verification URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://learnhub.in";
  page.drawText(`Verify at: ${appUrl}/verify/${certId}`, {
    x: width - 280,
    y: 45,
    size: 9,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.65)
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
