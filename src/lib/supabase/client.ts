/**
 * Client pentru browser (componente client-side).
 * Suportă autentificare locală și încărcare locală de fișiere pentru carnete.
 */
export function createClient() {
  return {
    auth: {
      signOut: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // ignore
        }
      },
    },
    storage: {
      from: (bucket: string) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        upload: async (filePath: string, file: File, _options?: unknown) => {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("filePath", filePath);
            formData.append("bucket", bucket);
            const res = await fetch("/api/storage/upload", {
              method: "POST",
              body: formData,
            });
            const json = await res.json();
            if (!res.ok || json.error) {
              return { data: null, error: { message: json.error || "Upload failed" } };
            }
            return { data: { path: json.filePath || filePath }, error: null };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { data: null, error: { message: msg } };
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        createSignedUrl: async (filePath: string, _expiresIn?: number) => {
          if (filePath.startsWith("data:") || filePath.startsWith("http://") || filePath.startsWith("https://")) {
            return { data: { signedUrl: filePath }, error: null };
          }
          return {
            data: { signedUrl: `/uploads/${filePath}` },
            error: null,
          };
        },
      }),
    },
  };
}
