import { reportError } from '@/utils/error-tracking';

const MIME_TYPE_PDF = 'application/pdf';
const MIME_TYPE_PLAINTEXT = 'text/plain';

const LLM_PLAIN_TEXT_MIME_TYPES = ['application/ics', 'text/calendar'];

const MIME_TYPE_BY_FILE_EXTENSION: Record<string, string> = {
  pdf: MIME_TYPE_PDF,
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ics: 'application/ics',
};

export const clientMimeType = ({ filename, mimeType }: { filename: string; mimeType: string }) => {
  if (mimeType === 'application/octet-stream') {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext && MIME_TYPE_BY_FILE_EXTENSION[ext]) {
      return MIME_TYPE_BY_FILE_EXTENSION[ext];
    }
    reportError(new Error(`Unknown MIME type with filename: ${filename}`));
    return mimeType;
  }
  return mimeType;
};

export const llmMimeType = ({ mimeType }: { mimeType: string }) => {
  if (mimeType === MIME_TYPE_PDF) {
    return mimeType;
  } else if (LLM_PLAIN_TEXT_MIME_TYPES.includes(mimeType)) {
    return MIME_TYPE_PLAINTEXT;
  }

  reportError(`Unsupported MIME type for LLM processing: ${mimeType}`);
  return null;
};
