export interface Ctor<T> {
  new (...args: never[]): T
}
