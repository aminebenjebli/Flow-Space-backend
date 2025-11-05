// Local minimal type declaration for `chrono-node`.
// The `@types/chrono-node` package is not available in the registry, so provide a simple
// fallback to keep TypeScript happy. Replace with stronger, upstream types if/when they
// become available or if you want to author complete types.

declare module 'chrono-node' {
  // Minimal, CommonJS-compatible typings for chrono-node used in this project.
  // Add more precise types if you rely on additional APIs.

  type ParsedDate = Date | null;

  interface Chrono {
    parse(text: string, ref?: Date, option?: any): any[];
    parseDate(text: string, ref?: Date, option?: any): Date | null;
  }

  const chrono: Chrono;
  export = chrono;
}
