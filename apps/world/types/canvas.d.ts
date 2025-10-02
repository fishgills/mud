declare module 'canvas' {
  export interface CanvasRenderingContext2D {
    canvas: Canvas;
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    fillRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    drawImage(
      image: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ): void;
    fillText?(text: string, x: number, y: number, maxWidth?: number): void;
    measureText?(text: string): { width: number };
  }

  export interface Canvas {
    width: number;
    height: number;
    getContext(type: '2d'): CanvasRenderingContext2D;
    toBuffer(...args: unknown[]): Buffer;
  }

  export interface ImageSource {
    width: number;
    height: number;
  }

  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(
    src: string | URL | Buffer,
  ): Promise<
    ImageSource & { data?: Uint8ClampedArray } & Record<string, unknown>
  >;
}
