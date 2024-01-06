import { defer, EMPTY, Subject, Subscription, takeUntil, tap } from 'rxjs'
import { Effect } from '../effect'
import { Hashable, hashValue } from '../hashable'

class SubscriptionsCollection {
  private readonly storage: Partial<Record<number, Set<Subscription>>> = {}

  insert(id: Hashable, subscription: Subscription): void {
    const hash = hashValue(id)

    if (!(hash in this.storage)) {
      this.storage[hash] = new Set()
    }

    this.storage[hash]?.add(subscription)
  }

  remove(id: Hashable, subscription: Subscription): void {
    const hash = hashValue(id)
    this.storage[hash]?.delete(subscription)

    if (this.storage[hash]?.size === 0) {
      delete this.storage[hash]
    }
  }

  unsubscribe(id: Hashable): void {
    const hash = hashValue(id)
    this.storage[hash]?.forEach((s) => s.unsubscribe())
    delete this.storage[hash]
  }
}

const cancellationSubscriptions = new SubscriptionsCollection()

declare module '../effect' {
  export interface Effect<Action> {
    cancellable(id: Hashable, cancelInFlight?: boolean): Effect<Action>
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Effect {
    export let cancel: <Action>(id: Hashable) => Effect<Action>
  }
}

Effect.prototype.cancellable = function cancellable<Action>(
  this: Effect<Action>,
  id: Hashable,
  cancelInFlight: boolean = false,
): Effect<Action> {
  if (!this.source) {
    return Effect.none()
  }

  const source = this.source

  return Effect.observable(
    defer(() => {
      if (cancelInFlight) {
        cancellationSubscriptions.unsubscribe(id)
      }

      const cancellationSubject = new Subject<void>()

      const subscription = new Subscription(() => {
        cancellationSubject.next()
        cancellationSubject.complete()
        cancellationSubscriptions.remove(id, subscription)
      })

      return source.pipe(
        takeUntil(cancellationSubject),
        tap({
          complete: () => subscription.unsubscribe(),
          subscribe: () => cancellationSubscriptions.insert(id, subscription),
          unsubscribe: () => subscription.unsubscribe(),
        }),
      )
    }),
  )
}

Effect.cancel = function cancel<Action>(id: Hashable): Effect<Action> {
  return Effect.observable(
    defer(() => {
      cancellationSubscriptions.unsubscribe(id)
      return EMPTY
    }),
  )
}
