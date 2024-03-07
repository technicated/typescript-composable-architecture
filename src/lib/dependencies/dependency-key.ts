export interface TestDependencyKey<T> {
  get previewValue(): T
}

const preview = Symbol('Dependencies preview slot')
const test = Symbol('Dependencies test slot')

type WithPreview<T extends object> = T & { [preview]?: { value: unknown } }
type WithTest<T extends object> = T & { [test]?: { value: unknown } }

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class TestDependencyKey<T> {
  abstract get testValue(): T

  static {
    Object.defineProperties(TestDependencyKey.prototype, {
      previewValue: {
        configurable: true,
        enumerable: true,
        get(this: WithPreview<TestDependencyKey<unknown>>) {
          return this[preview] ? this[preview].value : this.testValue
        },
        set(this: WithPreview<TestDependencyKey<unknown>>, value: unknown) {
          this[preview] = { value }
        },
      },
    })
  }
}

export interface DependencyKey<T> {
  get testValue(): T
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class DependencyKey<T> extends TestDependencyKey<T> {
  abstract get liveValue(): T

  //   override get previewValue(): T {
  //     return this.liveValue
  //   }

  //   override get testValue(): T {
  //     throw new Error(
  //       `${this.constructor.name} has no test value, but was accessed from a \
  // test context.

  // Dependencies registered with the library are not allowed to use their default, \
  // live implementations when run from tests.

  // To fix, override ${this.constructor.name} with a test value.`,
  //     )
  //   }

  static {
    Object.defineProperties(DependencyKey.prototype, {
      previewValue: {
        configurable: true,
        enumerable: true,
        get(this: WithPreview<DependencyKey<unknown>>) {
          return this[preview] ? this[preview].value : this.liveValue
        },
        set(this: WithPreview<DependencyKey<unknown>>, value: unknown) {
          this[preview] = { value }
        },
      },
      testValue: {
        configurable: true,
        enumerable: true,
        get(this: WithTest<DependencyKey<unknown>>) {
          if (this[test]) {
            return this[test].value
          } else {
            throw new Error(
              `${this.constructor.name} has no test value, but was accessed \
from a test context.

Dependencies registered with the library are not allowed to use their default, \
live implementations when run from tests.

To fix, override ${this.constructor.name} with a test value.`,
            )
          }
        },
        set(this: WithTest<DependencyKey<unknown>>, value: unknown) {
          this[test] = { value }
        },
      },
    })
  }
}

export interface DependencyKeyCtor<T> {
  new (): TestDependencyKey<T>
}
