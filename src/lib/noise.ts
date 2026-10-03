/** 固定的偽亂數（同一個 i 永遠得到同一個值），讓裝飾性的隨機排列在重新 render 時不跳動 */
export function noise(i: number, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
