import { useRef, useCallback } from 'react';

/**
 * Manages per-page fabric.js canvas annotation state.
 * Stores serialized JSON keyed by page number.
 */
export function useAnnotations() {
  const storeRef = useRef<Map<number, string>>(new Map());

  const save = useCallback((pageNum: number, json: string) => {
    storeRef.current.set(pageNum, json);
  }, []);

  const load = useCallback((pageNum: number): string | undefined => {
    return storeRef.current.get(pageNum);
  }, []);

  const hasAnnotation = useCallback((pageNum: number): boolean => {
    return storeRef.current.has(pageNum);
  }, []);

  const getAll = useCallback((): Map<number, string> => {
    return new Map(storeRef.current);
  }, []);

  const clear = useCallback(() => {
    storeRef.current.clear();
  }, []);

  return { save, load, hasAnnotation, getAll, clear };
}
