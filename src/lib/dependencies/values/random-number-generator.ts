import { DependencyKey } from '../dependency-key'
import { registerDependency } from '../dependency-values'

class RandomNumberGenerator {
  constructor(public next: () => number) {}
}

declare module '../dependency-values' {
  interface DependencyValues {
    randomNumberGenerator: RandomNumberGenerator
  }
}

class RandomNumberGeneratorKey implements DependencyKey<RandomNumberGenerator> {
  readonly liveValue = new RandomNumberGenerator(() => Math.random())

  readonly testValue = new RandomNumberGenerator(() => {
    throw new Error('unimplemented dependency "randomNumberGenerator"')
  })
}

registerDependency('randomNumberGenerator', RandomNumberGeneratorKey)
