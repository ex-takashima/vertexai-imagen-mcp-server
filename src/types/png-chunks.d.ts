/**
 * Type declarations for png-chunks packages
 */

declare module 'png-chunks-extract' {
  interface Chunk {
    name: string;
    data: Buffer;
  }

  function extract(buffer: Buffer): Chunk[];
  export = extract;
}

declare module 'png-chunks-encode' {
  interface Chunk {
    name: string;
    data: Buffer;
  }

  function encode(chunks: Chunk[]): Uint8Array;
  export = encode;
}

declare module 'png-chunk-text' {
  interface TextChunk {
    keyword: string;
    text: string;
  }

  interface Chunk {
    name: string;
    data: Buffer;
  }

  export function encode(keyword: string, text: string): Chunk;
  export function decode(data: Buffer): TextChunk;
}
