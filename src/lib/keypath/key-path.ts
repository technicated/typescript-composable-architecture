export class KeyPath<Root extends object, Value> {
  static for<Root extends object>(): KeyPath<Root, Root> {
    return new KeyPath(
      (root) => root,
      (root, value) => Object.assign(root, value),
    )
  }

  private constructor(
    public readonly get: (root: Root) => Value,
    public readonly set: (root: Root, value: Value) => void,
  ) {}

  appending<
    Root extends object,
    Value extends object,
    K extends keyof Value & number,
  >(this: KeyPath<Root, Value>, pathComponent: K): KeyPath<Root, Value[K]>
  appending<
    Root extends object,
    Value extends object,
    K extends keyof Value & string,
  >(this: KeyPath<Root, Value>, pathComponent: K): KeyPath<Root, Value[K]>
  appending<Root extends object, Value extends object, K extends keyof Value>(
    this: KeyPath<Root, Value>,
    pathComponent: K,
  ): KeyPath<Root, Value[K]> {
    return new KeyPath(
      (root) => this.get(root)[pathComponent],
      (root, prop) => {
        const value = this.get(root)
        value[pathComponent] = prop
        this.set(root, value)
      },
    )
  }

  modify(root: Root, update: (value: Value) => Value | void): void {
    let value = this.get(root)
    const result = update(value)

    if (result !== undefined) {
      value = result
    }

    this.set(root, value)
  }
}
