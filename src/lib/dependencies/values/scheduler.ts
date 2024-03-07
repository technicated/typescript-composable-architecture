import { asyncScheduler, SchedulerLike } from 'rxjs'
import { DependencyKey } from '../dependency-key'
import { registerDependency } from '../register-dependency'

export class UnimplementedScheduler implements SchedulerLike {
  now(): number {
    throw new Error('unimplemented dependency "scheduler.now"')
  }

  schedule(
    work: unknown,
    delay?: unknown,
    state?: unknown,
  ): import('rxjs').Subscription {
    void work
    void delay
    void state
    throw new Error('unimplemented dependency "scheduler.schedule"')
  }
}

declare module '../dependency-values' {
  interface DependencyValues {
    scheduler: SchedulerLike
  }
}

class SchedulerKey extends DependencyKey<SchedulerLike> {
  readonly liveValue = asyncScheduler
  readonly testValue = new UnimplementedScheduler()
}

registerDependency('scheduler', SchedulerKey)
