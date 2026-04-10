export const errorCodes = [
  'ORG_NOT_FOUND',
  'ORG_NOT_MEMBER',
  'ORG_PERMISSION_DENIED',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && (errorCodes as readonly string[]).includes(code);
}

