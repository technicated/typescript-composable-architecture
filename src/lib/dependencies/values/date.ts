import { DependencyKey } from '../dependency-key'
import { registerDependency } from '../register-dependency'

export class DateGenerator {
  static constant(date: Date): DateGenerator {
    return new DateGenerator(() => date)
  }

  get now(): Date {
    return this.generate()
  }

  set now(date: Date) {
    this.generate = () => date
  }

  constructor(private generate: () => Date) {}
}

declare module '../dependency-values' {
  interface DependencyValues {
    date: DateGenerator
  }
}

class DateGeneratorKey extends DependencyKey<DateGenerator> {
  readonly liveValue = new DateGenerator(() => new Date())

  readonly testValue = new DateGenerator(() => {
    throw new Error('unimplemented dependency "date"')
  })
}

registerDependency('date', DateGeneratorKey)
