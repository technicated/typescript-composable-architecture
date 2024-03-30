export const get = Symbol()
export const set = Symbol()

type Length<T extends unknown[]> = T extends { length: infer L extends number }
  ? L
  : never

type BuildTuple<L extends number, T extends unknown[] = []> = T extends {
  length: L
}
  ? T
  : BuildTuple<L, [...T, unknown]>

type Add<A extends number, B extends number> = Length<
  [...BuildTuple<A>, ...BuildTuple<B>]
>

type Incr<A extends number> = Add<A, 1>

interface KeyPathAccessors<Root extends object, Value> {
  readonly [get]: (root: Root) => Value
  readonly [set]: (root: Root, value: Value) => void
}

type ArrayKeyPathImpl<
  Root extends object,
  Value extends unknown[],
  Index extends number,
> = Value extends []
  ? NonNullable<unknown>
  : Value extends [infer H, ...infer T]
    ? Record<Index, KeyPath<Root, H>> & ArrayKeyPathImpl<Root, T, Incr<Index>>
    : Value extends Array<infer T>
      ? Record<number, KeyPath<Root, T>>
      : Record<number, KeyPath<Root, unknown>>

type ArrayKeyPath<
  Root extends object,
  Value extends unknown[],
> = KeyPathAccessors<Root, Value> & ArrayKeyPathImpl<Root, Value, 0>

type ObjectKeyPath<
  Root extends object,
  Value extends object,
> = KeyPathAccessors<Root, Value> & {
  [K in keyof Value]: KeyPath<Root, Value[K]>
}

export type KeyPath<Root extends object, Value> = Value extends unknown[]
  ? ArrayKeyPath<Root, Value>
  : Value extends object
    ? ObjectKeyPath<Root, Value>
    : KeyPathAccessors<Root, Value>

interface ObjCtor<Root extends object> {
  new (...args: never[]): Root
}

class KeyPathImpl<Root extends object> {
  constructor(
    public readonly base: ObjCtor<Root>,
    public readonly path: Array<number | string | symbol>,
  ) {}

  [get](root: Root): unknown {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.path.reduce((carry, item) => carry[item], root)
  }

  [set](root: Root, value: unknown): void {
    if (this.path.length === 0) {
      Object.assign(root, value)
    } else {
      console.log('a', this.path)
      const path = [...this.path]
      console.log('b')
      const prop = path.pop()!

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const container = path.reduce((carry, item) => carry[item], root)

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      container[prop] = value
    }
  }
}

export function KeyPath<Root extends object>(
  root: ObjCtor<Root>,
): KeyPath<Root, Root> {
  return makeProxy(new KeyPathImpl(root, [])) as KeyPath<Root, Root>

  function makeProxy(impl: KeyPathImpl<Root>): unknown {
    return new Proxy(impl, {
      get(target, prop) {
        console.log('prop', prop)
        if (prop === get) {
          return target[get].bind(target)
        }

        if (prop === set) {
          return target[set].bind(target)
        }

        console.log('target', target)
        return makeProxy(new KeyPathImpl(target.base, [...target.path, prop]))
      },
      set: () => false,
    })
  }
}
