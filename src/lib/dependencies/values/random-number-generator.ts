import { DependencyKey } from '../dependency-key'
import { registerDependency } from '../register-dependency'

export class RandomNumberGenerator {
  constructor(public next: () => number) {}
}

declare module '../dependency-values' {
  interface DependencyValues {
    randomNumberGenerator: RandomNumberGenerator
  }
}

class RandomNumberGeneratorKey extends DependencyKey<RandomNumberGenerator> {
  readonly liveValue = new RandomNumberGenerator(() => Math.random())

  readonly testValue = new RandomNumberGenerator(() => {
    throw new Error('unimplemented dependency "randomNumberGenerator"')
  })
}

registerDependency('randomNumberGenerator', RandomNumberGeneratorKey)
