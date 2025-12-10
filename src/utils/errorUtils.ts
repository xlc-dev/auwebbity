export function getErrorMessage(error: unknown, fallback: string = "An error occurred"): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) && error.name === "AbortError"
  );
}
