export default class ValidationEngine {
  validateRequired(
    value: unknown
  ): boolean {
    return value !== null &&
      value !== undefined &&
      value !== "";
  }
}