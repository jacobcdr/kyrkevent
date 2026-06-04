import fs from "fs/promises";
import path from "path";

export async function getUploadDirectoryStats(rootDir) {
  let bytes = 0;
  let files = 0;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(full);
          bytes += stat.size;
          files += 1;
        } catch {
          /* ignore */
        }
      }
    }
  }

  await walk(rootDir);
  return { bytes, files };
}

/** Filesystem stats for mounted volume (Node 18+). */
export async function getVolumeStats(targetPath) {
  try {
    if (typeof fs.statfs !== "function") {
      return { available: false };
    }
    const s = await fs.statfs(targetPath);
    const bsize = Number(s.bsize);
    const totalBytes = Number(s.blocks) * bsize;
    const freeBytes = Number(s.bfree) * bsize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return {
      available: true,
      totalBytes,
      freeBytes,
      usedBytes
    };
  } catch {
    return { available: false };
  }
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
