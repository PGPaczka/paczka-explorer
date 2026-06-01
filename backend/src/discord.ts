import { DISCORD_WEBHOOK_URL } from './config';

interface UploadNotification {
  uploader: string;
  targetPath: string;
  files: { original_name: string; size: number }[];
  type?: 'folder';
  folderName?: string;
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Send a Discord webhook notification about a new upload.
 * Fails silently — notifications are best-effort.
 */
export async function notifyNewUpload(info: UploadNotification): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;

  try {
    const isFolder = info.type === 'folder';
    const title = isFolder
      ? '📁 Nowy folder do zatwierdzenia'
      : '📤 Nowe pliki do zatwierdzenia';

    const fields: any[] = [
      { name: '👤 Wrzucił', value: info.uploader || 'Anonim', inline: true },
      { name: '📂 Ścieżka docelowa', value: info.targetPath || '/ (główna)', inline: true },
    ];

    if (isFolder) {
      fields.push({ name: '📁 Nazwa folderu', value: info.folderName || '?', inline: false });
    } else {
      const fileList = info.files
        .map(f => `• \`${f.original_name}\` (${formatSize(f.size)})`)
        .join('\n');
      fields.push({
        name: `📎 Pliki (${info.files.length})`,
        value: fileList.length > 1024 ? fileList.slice(0, 1020) + '...' : fileList,
        inline: false,
      });

      const totalSize = info.files.reduce((sum, f) => sum + f.size, 0);
      fields.push({ name: '💾 Łączny rozmiar', value: formatSize(totalSize), inline: true });
    }

    const embed = {
      title,
      color: isFolder ? 0x2196F3 : 0x4CAF50,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'Paczka INFA' },
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('[discord] Webhook notification failed:', (err as Error).message);
  }
}
