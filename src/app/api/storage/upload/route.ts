import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const filePath = (formData.get("filePath") as string) || (file?.name ? `id-cards/${file.name}` : "");

    if (!file || !filePath) {
      return NextResponse.json({ error: "Fișier sau cale lipsă." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const baseDir = isServerless ? path.join("/tmp", "uploads") : path.join(process.cwd(), "public", "uploads");
    const resolvedBase = path.resolve(baseDir);

    // Sanitize path against directory traversal
    const normalizedFilePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.resolve(resolvedBase, normalizedFilePath);

    if (!fullPath.startsWith(resolvedBase + path.sep)) {
      return NextResponse.json({ error: "Cale invalidă." }, { status: 403 });
    }

    if (isServerless) {
      const mimeType = file.type || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      // Also try saving to /tmp if possible, but return dataUrl for durability
      try {
        const targetDir = path.dirname(fullPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, buffer);
      } catch {
        // ignore tmp write errors
      }
      return NextResponse.json({ success: true, filePath: dataUrl });
    }

    const targetDir = path.dirname(fullPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);

    return NextResponse.json({ success: true, filePath: normalizedFilePath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
