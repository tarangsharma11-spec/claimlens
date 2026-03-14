import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { extractPdfText } from "@/app/lib/pdf-extract";

/**
 * POST /api/upload
 * Accepts file uploads, extracts text from PDFs server-side,
 * and returns the extracted text for each file.
 *
 * This replaces the client-side FileReader.readAsText() approach
 * which returns garbled binary for PDF files.
 */
export async function POST(request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const results = {};

    for (const file of files) {
      const name = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        if (file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
          const { text, pages } = await extractPdfText(buffer);
          results[name] = {
            text: `[PDF: ${pages} pages]\n\n${text}`,
            pages,
            type: "pdf",
            size: buffer.length,
          };
        } else {
          // Plain text, HTML, markdown, RTF, etc.
          results[name] = {
            text: buffer.toString("utf-8"),
            type: "text",
            size: buffer.length,
          };
        }
      } catch (err) {
        results[name] = {
          text: `[Error extracting ${name}: ${err.message}]`,
          type: "error",
          error: err.message,
        };
      }
    }

    return NextResponse.json({ files: results });
  } catch (err) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

// Increase body size limit for file uploads (default is 4MB in Next.js)
export const config = {
  api: {
    bodyParser: false,
  },
};
