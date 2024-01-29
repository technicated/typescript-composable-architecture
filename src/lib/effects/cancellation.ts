import { defer, EMPTY, Subject, Subscription, takeUntil, tap } from 'rxjs'
import { Effect } from '../effect'
import { hash } from '../internal'

class SubscriptionsCollection {
  private readonly storage: Partial<Record<number, Set<Subscription>>> = {}

  insert<ID>(id: ID, subscription: Subscription): void {
    const hashValue = hash(id)

    if (!(hashValue in this.storage)) {
      this.storage[hashValue] = new Set()
    }

    this.storage[hashValue]?.add(subscription)
  }

  remove<ID>(id: ID, subscription: Subscription): void {
    const hashValue = hash(id)
    this.storage[hashValue]?.delete(subscription)

    if (this.storage[hashValue]?.size === 0) {
      delete this.storage[hashValue]
    }
  }

  unsubscribe<ID>(id: ID): void {
    const hashValue = hash(id)
    this.storage[hashValue]?.forEach((s) => s.unsubscribe())
    delete this.storage[hashValue]
  }
}

const cancellationSubscriptions = new SubscriptionsCollection()

declare module '../effect' {
  export interface Effect<Action> {
    cancellable<ID>(id: ID, cancelInFlight?: boolean): Effect<Action>
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Effect {
    export let cancel: <Action, ID>(id: ID) => Effect<Action>
  }
}

Effect.prototype.cancellable = function cancellable<Action, ID>(
  this: Effect<Action>,
  id: ID,
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

Effect.cancel = function cancel<Action, ID>(id: ID): Effect<Action> {
  return Effect.observable(
    defer(() => {
      cancellationSubscriptions.unsubscribe(id)
      return EMPTY
    }),
  )
}
