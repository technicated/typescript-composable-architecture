import { cloneDeep } from 'lodash'

export interface DependencyKey<T> {
  readonly liveValue: T
  readonly testValue?: T
}

interface DependencyKeyCtor<T> {
  new (): DependencyKey<T>
}

export class DependencyValues {
  static current = new DependencyValues()

  static withScopedDependencies<R>(
    updateDependencies: (dependencies: DependencyValues) => void,
    operation: () => R,
  ): R {
    const original = DependencyValues.current
    DependencyValues.current = cloneDeep(original)
    updateDependencies(DependencyValues.current)
    const result = operation()
    DependencyValues.current = original
    return result
  }

  private readonly keyCache = new Map<unknown, unknown>()
  private readonly storage = new Map<unknown, unknown>()

  private constructor(
    private readonly parent: DependencyValues | null = null,
  ) {}

  get<T>(Key: DependencyKeyCtor<T>): T {
    if (this.storage.has(Key)) {
      return this.storage.get(Key) as T
    } else if (this.keyCache.has(Key)) {
      const key = this.keyCache.get(Key) as DependencyKey<T>
      return key.liveValue // todo: add Context
    } else if (this.parent) {
      return this.parent.get(Key)
    } else {
      const key = new Key()
      this.keyCache.set(Key, key)
      return key.liveValue // todo: add Context
    }
  }

  set<T>(Key: DependencyKeyCtor<T>, value: T): void {
    this.storage.set(Key, value)
  }
}

export function withDependencies<R>(
  updateDependencies: (dependencies: DependencyValues) => void,
  operation: () => R,
): R {
  return DependencyValues.withScopedDependencies(updateDependencies, operation)
}

export function registerDependency<Prop extends keyof DependencyValues>(
  prop: Prop,
  key: DependencyKeyCtor<DependencyValues[Prop]>,
): void {
  Object.defineProperty(DependencyValues.prototype, prop, {
    configurable: false,
    enumerable: true,
    get(this: DependencyValues) {
      return this.get(key)
    },
    set(this: DependencyValues, value) {
      this.set(key, value)
    },
  })
}

// interface Ctor<T> {
//   new(): DependencyKey<T>
// }

// class DependencyValues {
//   static current = new DependencyValues()

//   #cache = new Map<any, any>()
//   #storage = new Map<any, any>()

//   get<T>(key: Ctor<T>): T {
//     const found = this.#storage.get(key)

//     if (found !== undefined) {
//       return found
//     }

//     const cached = this.#cache.get(key)

//     if (cached !== undefined) {
//       return cached
//     }

//     const result = (new key()).liveValue
//     this.#cache.set(key, result)
//     return result
//   }

//   set<T>(key: Ctor<T>, value: T): void {
//     this.#storage.set(key, value)
//   }
// }

// function withDependencies<T>(
//   work: () => T,
//   updateDependencies: (dependencies: DependencyValues) => void
// ): T {
//   DependencyValues.current = Object.setPrototypeOf(new DependencyValues(), DependencyValues.current)
//   updateDependencies(DependencyValues.current)
//   const result = work()
//   DependencyValues.current = Object.getPrototypeOf(DependencyValues.current)
//   return result
// }

// function helper<
//   Prop extends keyof DependencyValues,
//   Key extends DependencyValues[Prop]
// >(
//   prop: Prop,
//   key: Ctor<Key>
// ): void {
//   Object.defineProperty(DependencyValues.prototype, prop, {
//     configurable: false,
//     enumerable: true,
//     get: () => DependencyValues.current.get(key),
//     set: (value) => DependencyValues.current.set(key, value),
//   })
// }

// class Dep {
//   constructor(public readonly str: string) { }
// }

// class DepKey implements DependencyKey<Dep> {
//   readonly liveValue = new Dep('hello live')
// }

// interface DependencyValues {
//   dep: Dep
// }

// helper('dep', DepKey)

// class ApiClient {
//   constructor(public readonly n: number) { }
// }

// class ApiClientKey implements DependencyKey<ApiClient> {
//   readonly liveValue = new ApiClient(0)
// }

// interface DependencyValues {
//   apiClient: ApiClient
// }

// helper('apiClient', ApiClientKey)

// console.log(DependencyValues.current.apiClient)
// console.log(DependencyValues.current.dep)

// withDependencies(() => {
//   console.log(DependencyValues.current.apiClient)
//   console.log(DependencyValues.current.dep)

//   withDependencies(() => {
//     console.log(DependencyValues.current.apiClient)
//     console.log(DependencyValues.current.dep)
//   }, (dependencies) => {
//     dependencies.apiClient = new ApiClient(-1)
//   })

//   console.log(DependencyValues.current.apiClient)
//   console.log(DependencyValues.current.dep)
// }, (dependencies) => {
//   dependencies.apiClient = new ApiClient(42)
// })

// console.log(DependencyValues.current.apiClient)
// console.log(DependencyValues.current.dep)

// function dependency<K extends keyof DependencyValues>(key: K) {
//   return DependencyValues.current[key]
// }

// class Magic {
//     apiClient = dependency('apiClient')

//   constructor() {
//     console.log('MAGIC', this.apiClient.n)
//   }
// }

// new Magic()

// withDependencies(() => {
//   new Magic()
// }, (dependencies) => {
//   dependencies.apiClient = new ApiClient(-1)
// })

// new Magic()

// ----------------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------------

// // Import stylesheets
// import './style.css'
// import { cloneDeep } from 'lodash'
// import * as uuid from 'uuid'

// // Write TypeScript code!
// const appDiv: HTMLElement = document.getElementById('app')
// appDiv.innerHTML = '<h1>TypeScript Starter</h1>'

// interface KeyCtor<T> {
//   new (): DependencyKey<T>;
// }

// interface DependencyKey<Value> {
//   readonly liveValue: Value;
//   readonly testValue?: Value;
// }

// class DependencyValues {
//   static current = new DependencyValues()

//   static withScopedDependencies<R>(
//     updateDependencies: (dependencies: DependencyValues) => void,
//     operation: () => R
//   ): R {
//     const original = DependencyValues.current
//     DependencyValues.current = cloneDeep(original)
//     updateDependencies(DependencyValues.current)
//     const result = operation()
//     DependencyValues.current = original
//     return result
//   }

//   readonly #parent: DependencyValues | null = null
//   readonly #storage = new Map<any, any>()

//   constructor(parent: DependencyValues | null = null) {
//     this.#parent = parent
//   }

//   get<T>(key: KeyCtor<T>): T {
//     if (this.#storage.has(key)) {
//       return this.#storage.get(key)
//     } else if (this.#parent) {
//       return this.#parent.get(key)
//     } else {
//       return new key().liveValue
//     }
//   }

//   set<T>(key: KeyCtor<T>, value: T): void {
//     this.#storage.set(key, value)
//   }
// }

// enum DependencyEnvironment {
//   live,
//   test,
// }

// interface DependencyValues {
//   environment: DependencyEnvironment;
// }

// class DependencyEnvironmentKey implements DependencyKey<DependencyEnvironment> {
//   readonly liveValue = DependencyEnvironment.live
//   readonly testValue = DependencyEnvironment.test
// }

// helper('environment', DependencyEnvironmentKey)

// function dependency<Key extends keyof DependencyValues>(
//   key: Key
// ): DependencyValues[Key] {
//   return DependencyValues.current[key]
// }

// function withDependencies<R>(
//   updateDependencies: (dependencies: DependencyValues) => void,
//   operation: () => R
// ): R {
//   return DependencyValues.withScopedDependencies(updateDependencies, operation)
// }

// function helper<Prop extends keyof DependencyValues>(
//   prop: Prop,
//   key: KeyCtor<DependencyValues[Prop]>
// ): void {
//   Object.defineProperty(DependencyValues.current, prop, {
//     configurable: false,
//     enumerable: true,
//     get: () => DependencyValues.current.get(key),
//     set: (value) => DependencyValues.current.set(key, value),
//   })
// }

// // ------------

// class ApiClient {
//   constructor(public n: number) {}

//   getValue(): number {
//     return this.n
//   }
// }

// interface DependencyValues {
//   apiClient: ApiClient;
// }

// class ApiClientKey implements DependencyKey<ApiClient> {
//   readonly liveValue = new ApiClient(42)
// }

// helper('apiClient', ApiClientKey)

// class UuidGenerator {
//   constructor(public readonly generate: () => string) {}
// }

// interface DependencyValues {
//   uuid: UuidGenerator;
// }

// class UuidGeneratorKey implements DependencyKey<UuidGenerator> {
//   readonly liveValue = new UuidGenerator(uuid.v4)

//   get testValue(): UuidGenerator {
//     let index = 0

//     return new UuidGenerator(() => {
//       const result = `00000000-0000-0000-0000-${index.toString().padStart(12, '0')}`
//       index += 1
//       return result
//     })
//   }

//   /*readonly testValue = (() => {
//     let index = 0;

//     return new UuidGenerator(() => {
//       const result = `00000000-0000-0000-0000-${index
//         .toString()
//         .padStart(12, '0')}`;
//       index += 1;
//       return result;
//     });
//   })();*/
// }

// helper('uuid', UuidGeneratorKey)

// class MyClass {
//   private readonly apiClient = dependency('apiClient')

//   constructor() {
//     console.log('MAGIC', this.apiClient)
//   }
// }

// new MyClass()

// withDependencies(
//   (dependencies) => {
//     dependencies.apiClient.n = -1
//     dependencies.uuid = new UuidGeneratorKey().testValue
//   },
//   () => {
//     new MyClass()

//     console.log(dependency('uuid').generate())
//     console.log(dependency('uuid').generate())

//     withDependencies(
//       (dependencies) => {
//         dependencies.apiClient = new ApiClient(555)
//         dependencies.uuid = new UuidGeneratorKey().testValue
//       },
//       () => {
//         console.log(dependency('uuid').generate())
//         console.log(dependency('uuid').generate())
//         new MyClass()
//       }
//     )

//     new MyClass()

//     console.log(dependency('uuid').generate())
//     console.log(dependency('uuid').generate())
//   }
// )

// new MyClass()
