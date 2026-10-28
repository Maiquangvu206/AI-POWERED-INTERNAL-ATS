/** Tên queue — dùng chung giữa producer và consumer, không hard-code chuỗi rải rác. */
export const CV_PROCESSING_QUEUE = 'cv-processing';

/** Dead Letter Queue: job đã hết số lần thử được chuyển sang đây để điều tra tay. */
export const CV_PROCESSING_DLQ = 'cv-processing-dlq';

export const CV_PROCESSING_JOB = 'process-cv';

/** Job chết được lưu lại vĩnh viễn (không auto-remove) để còn dấu vết. */
export const DLQ_JOB = 'cv-processing-dead';
