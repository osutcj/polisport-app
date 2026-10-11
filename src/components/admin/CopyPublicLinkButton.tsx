"use client";

import { useState, useTransition } from "react";
import { revalidatePublicAction } from "@/lib/actions/publicActions";
import type { SportType } from "@/lib/sport";

async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Try modern Clipboard API if supported and in secure context
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Legacy fallback for non-secure contexts (HTTP over remote IP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export default function CopyPublicLinkButton({ sport }: { sport: SportType }) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopy = () => {
    startTransition(async () => {
      try {
        await revalidatePublicAction();
      } catch {
        // Ignore background revalidation errors
      }

      const url = `${window.location.origin}/public?sport=${sport}`;
      await copyToClipboard(url);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      disabled={isPending}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
        copied
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20"
      }`}
    >
      {copied ? "✅ Link Copiat!" : isPending ? "⏳ Se actualizează..." : "🔗 Copiază Link Public"}
    </button>
  );
}
