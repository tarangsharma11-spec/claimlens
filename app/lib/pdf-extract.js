/**
 * Server-side PDF text extraction.
 *
 * The existing client.js uses FileReader.readAsText() which returns garbled
 * binary for PDFs. This utility extracts actual text from uploaded PDFs
 * server-side using pdf-parse.
 *
 * Install: npm install pdf-parse
 *
 * Usage from an API route:
 *   import { extractPdfText } from "@/app/lib/pdf-extract";
 *   const text = await extractPdfText(buffer);
 */

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer - The PDF file as a Buffer
 * @returns {Promise<{text: string, pages: number, info: object}>}
 */
export async function extractPdfText(buffer) {
  // Dynamic import to avoid build errors if pdf-parse isn't installed
  let pdfParse;
  try {
    pdfParse = (await import("pdf-parse")).default;
  } catch {
    throw new Error(
      "pdf-parse is not installed. Run: npm install pdf-parse"
    );
  }

  const result = await pdfParse(buffer);

  return {
    text: result.text || "",
    pages: result.numpages || 0,
    info: {
      title: result.info?.Title || "",
      author: result.info?.Author || "",
      creator: result.info?.Creator || "",
    },
  };
}

/**
 * Extract text from multiple files. Handles PDFs, plain text, and common doc formats.
 * @param {Array<{name: string, buffer: Buffer, type: string}>} files
 * @returns {Promise<Object<string, string>>} Map of filename → extracted text
 */
export async function extractTexts(files) {
  const results = {};

  for (const file of files) {
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { text, pages } = await extractPdfText(file.buffer);
        results[file.name] = `[PDF: ${pages} pages]\n\n${text}`;
      } else {
        // Plain text, HTML, markdown, etc.
        results[file.name] = file.buffer.toString("utf-8");
      }
    } catch (err) {
      results[file.name] = `[Error extracting ${file.name}: ${err.message}]`;
    }
  }

  return results;
}
