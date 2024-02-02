import { Ctor } from './types'

export interface DependencyEngine {
  resolve<T>(token: Ctor<T>): T

  withDependencies<Result>(
    dependencies: Map<unknown, unknown>,
    operation: () => Result,
  ): Result
}

class DependencyValues {
  constructor(public readonly storage: Map<unknown, unknown> = new Map()) {}

  get<T>(token: Ctor<T>): T {
    if (this.storage.has(token)) {
      return this.storage.get(token) as T
    } else {
      throw new Error(`No value for token '${token.name}'`)
    }
  }
}

class DefaultDependencyEngine implements DependencyEngine {
  private stack: DependencyValues[] = [new DependencyValues()]

  resolve<T>(token: Ctor<T>): T {
    for (const values of this.stack) {
      try {
        return values.get(token)
      } catch {
        continue
      }
    }

    throw new Error(`No value for token '${token.name}'`)
  }

  withDependencies<Result>(
    dependencies: Map<unknown, unknown>,
    operation: () => Result,
  ): Result {
    this.stack.unshift(new DependencyValues(dependencies))
    const result = operation()
    this.stack.shift()
    return result
  }
}

const defaultEngine: DependencyEngine = new DefaultDependencyEngine()

const dependencies = {
  engine: defaultEngine,
  getEngine(): DependencyEngine {
    return this.engine
  },
  setEngine(engine: DependencyEngine): void {
    this.engine = engine
  },
}

export const getDependencyEngine = dependencies.getEngine.bind(dependencies)
export const setDependencyEngine = dependencies.setEngine.bind(dependencies)
