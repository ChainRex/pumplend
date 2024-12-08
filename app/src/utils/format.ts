/**
 * 将链上数值格式化为带小数点的字符串
 * @param value 链上数值
 * @param decimals 小数位数
 */
export function formatUnits(value: string | number, decimals: number): string {
  const valueStr = value.toString().padStart(decimals + 1, '0');
  const integerPart = valueStr.slice(0, -decimals) || '0';
  const decimalPart = valueStr.slice(-decimals).replace(/0+$/, '');
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
} 