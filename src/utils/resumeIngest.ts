import { agentFetch } from './agentApi';

const MAX_RESUME_BYTES = 4 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function ingestResumeFile(
  file: File
): Promise<{ fileName: string; text: string }> {
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error('Resume files must be 4MB or smaller.');
  }

  const fileName = file.name;
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json')) {
    const text = (await file.text()).trim();
    if (!text) {
      throw new Error('That text file was empty.');
    }
    return { fileName, text };
  }

  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    throw new Error('Legacy .doc files are not supported. Upload PDF, DOCX, TXT, or Markdown.');
  }

  if (lower.endsWith('.pdf') || lower.endsWith('.docx')) {
    const dataBase64 = await fileToBase64(file);
    const result = await agentFetch<{ text: string; fileName: string }>(
      '/api/agent/parse-resume',
      {
        fileName,
        mimeType: file.type || (lower.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        dataBase64,
      }
    );
    const text = (result.text || '').trim();
    if (!text) {
      throw new Error('Could not extract readable text from that file.');
    }
    return { fileName: result.fileName || fileName, text };
  }

  throw new Error('Upload a PDF, DOCX, TXT, or Markdown resume.');
}
