interface ObjectCtor<Root extends object> {
  new (...args: never[]): Root
}

export class KeyPath<Root extends object, Value> {
  static for<Root extends object>(
    base?: ObjectCtor<Root>,
  ): KeyPath<Root, Root> {
    return new KeyPath(base)
  }

  private constructor(
    private readonly base?: ObjectCtor<Root>,
    private readonly path: Array<number | string | symbol> = [],
  ) {}

  appending<
    Root extends object,
    Value extends object,
    Prop extends keyof Value,
  >(
    this: KeyPath<Root, Value>,
    prop: Prop | KeyPath<Value, Prop>,
  ): KeyPath<Root, Value[Prop]> {
    if (prop instanceof KeyPath) {
      return new KeyPath(this.base, [...this.path, ...prop.path])
    } else {
      return new KeyPath(this.base, [...this.path, prop])
    }
  }

  get(root: Root): Value {
    return this.path.reduce(
      (carry, item) => carry[item as keyof typeof carry],
      root as object,
    ) as Value
  }

  modify(root: Root, update: (value: Value) => Value | void): void {
    let value = this.get(root)
    const result = update(value)

    if (result !== undefined) {
      value = result
    }

    this.set(root, value)
  }

  set(root: Root, value: Value): void {
    const p = this.path[this.path.length - 1]

    if (p !== undefined) {
      const ref = this.path
        .slice(0, -1)
        .reduce(
          (carry, item) => carry[item as keyof typeof carry],
          root as object,
        ) as Record<typeof p, Value>

      ref[p] = value
    } else {
      Object.assign(root, value)
    }
  }
}
