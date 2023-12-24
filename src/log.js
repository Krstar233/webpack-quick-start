export class Log {
  static info(tag, ...args) {
    console.info(`[${tag}]`, ...args);
  }
  static warn(tag, ...args) {
    console.warn(`[${tag}]`, ...args);
  }
  static error(tag, ...args) {
    console.error(`[${tag}]`, ...args);
  }
}
