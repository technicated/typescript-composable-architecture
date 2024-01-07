import { SchedulerAction, SchedulerLike, Subscription } from 'rxjs'

interface ScheduledWork {
  action: () => void
  date: number
  sequence: number
}

class TestSchedulerAction<T>
  extends Subscription
  implements SchedulerAction<T>
{
  constructor(
    private readonly scheduler: TestScheduler,
    private readonly work: (this: SchedulerAction<T>, state?: T) => void,
    private readonly state?: T,
  ) {
    super()
  }

  execute(): void {
    if (this.closed) {
      new Error('executing a cancelled action')
    }

    this.work.call(this, this.state)
  }

  schedule(state?: T | undefined, delay?: number | undefined): Subscription {
    if (this.closed) {
      return this
    }

    return this.scheduler.schedule(this.work, delay, state)
  }
}

type AdvanceFnArg = { by: number } | { to: number }

export class TestScheduler implements SchedulerLike {
  private date: number
  private lastSequence: number = 0
  private scheduled: ScheduledWork[] = []

  constructor(now: number = 0) {
    this.date = now
  }

  public advance(_?: { by: number }): void
  public advance(_: { to: number }): void
  public advance(arg?: AdvanceFnArg): void {
    const newDate = arg
      ? 'by' in arg
        ? this.now() + arg.by
        : arg.to
      : this.now()

    while (this.now() <= newDate) {
      this.scheduled.sort((a, b) =>
        a.date === b.date ? a.sequence - b.sequence : a.date - b.date,
      )

      const next = this.scheduled[0]

      if (!next || newDate < next.date) {
        this.date = newDate
        return
      }

      this.date = next.date
      this.scheduled.shift()
      next.action()
    }
  }

  run(): void {
    let date = this.scheduled[0]?.date

    while (date !== undefined) {
      this.advance({ to: date })
      date = this.scheduled[0]?.date
    }
  }

  public schedule<T>(
    work: (this: SchedulerAction<T>, state?: T) => void,
    delay: number = 0,
    state?: T,
  ): Subscription {
    const sequence = this.nextSequence()

    const action = new TestSchedulerAction(this, work, state)

    this.scheduled.push({
      action: action.execute.bind(action),
      date: this.now() + delay,
      sequence,
    })

    return action
  }

  now(): number {
    return this.date
  }

  private nextSequence(): number {
    this.lastSequence += 1
    return this.lastSequence
  }
}
