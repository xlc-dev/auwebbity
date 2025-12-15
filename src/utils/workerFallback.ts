type WorkerOperation<T> = () => Promise<T>;
type FallbackOperation<T> = () => T;

export async function withWorkerFallback<T>(
  useWorker: boolean,
  workerOp: WorkerOperation<T>,
  fallbackOp: FallbackOperation<T>
): Promise<T> {
  if (useWorker) {
    try {
      return await workerOp();
    } catch {
      return fallbackOp();
    }
  }
  return fallbackOp();
}
