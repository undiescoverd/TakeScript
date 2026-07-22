// Shared constants imported by both client components and Convex functions.

// Maximum size for an uploaded brand guideline file. Enforced client-side
// (UploadGuidelinesDialog) for fast feedback and server-side
// (convex/fileUpload.ts extractTextFromFile) as the actual enforcement point.
export const MAX_GUIDELINE_FILE_BYTES = 10 * 1024 * 1024;
