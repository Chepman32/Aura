export interface Filter {
  id: string;
  name: string;
  dominantColor: string;
  colorMatrix: number[]; // 4x5 = 20 values
  lutFile: string | null;
}
