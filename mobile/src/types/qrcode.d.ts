declare module "qrcode" {
  export function toDataURL(
    text: string | Buffer,
    options?: {
      margin?: number;
      scale?: number;
      width?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    }
  ): Promise<string>;

  export function toString(
    text: string | Buffer,
    options?: {
      type?: "svg" | "utf8" | "terminal";
      margin?: number;
      scale?: number;
    }
  ): Promise<string>;
}
