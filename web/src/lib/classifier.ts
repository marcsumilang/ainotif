// Server API routes share the backend pipeline; credentials stay server-side.
export {
  classifyNotification, ClassificationResultSchema, isSensitiveOtp,
  type ClassificationResult,
} from "../../../backend/src/ai/classifier";
