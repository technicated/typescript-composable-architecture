// todo: readonly properties are not supported, treated as writable

interface ObjectCtor<Root extends object> {
  new (...args: never[]): Root
}

export class KeyPath<Root extends object, Value> {
  static for<Root extends object>(
    base?: ObjectCtor<Root>,
  ): KeyPath<Root, Root> {
    return new KeyPath(
      base,
      (root) => root,
      (root, value) => Object.assign(root, value),
    )
  }

  private constructor(
    private readonly base: ObjectCtor<Root> | undefined,
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
      this.base,
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
