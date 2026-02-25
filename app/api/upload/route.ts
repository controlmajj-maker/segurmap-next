import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const previousUrl = formData.get("previousUrl") as string | null;

  // Delete previous blob if provided
  if (previousUrl) {
    try {
      await del(previousUrl);
    } catch {
      // Silently ignore if previous blob no longer exists
    }
  }

  const blob = await put(file.name, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
