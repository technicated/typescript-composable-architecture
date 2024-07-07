import { Signal, signal, WritableSignal } from '@angular/core'
import { produce } from 'immer'
import { Subscription, tap, Unsubscribable } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { Effect } from './effect'
import { Reducer } from './reducer'

export class RootStore {
  readonly #bufferedActions: unknown[] = []
  readonly #effectSubscriptions = new Map<string, Subscription>()
  #isSending = false
  readonly #reducer: Reducer<object, unknown>
  readonly #state: WritableSignal<object>

  get state(): Signal<object> {
    return this.#state.asReadonly()
  }

  constructor(initialState: object, reducer: Reducer<object, unknown>) {
    this.#reducer = reducer
    this.#state = signal(initialState)
  }

  send(action: unknown): Unsubscribable | null {
    this.#bufferedActions.push(action)
    if (this.#isSending) return null

    this.#isSending = true

    const unsubscribables: Unsubscribable[] = []

    while (this.#bufferedActions.length) {
      const currentAction = this.#bufferedActions.shift()!
      let effect = Effect.none()

      this.#state.update((state) => {
        return produce(state, (draft) => {
          effect = this.#reducer.reduce(draft, currentAction)
        })
      })

      switch (effect.operation.case) {
        case 'none':
          break
        case 'observable': {
          let didComplete = false
          const uuid = uuidv4()
          const effectSubscription = effect.operation.p
            .pipe(
              tap({
                unsubscribe: () => {
                  this.#effectSubscriptions.get(uuid)?.unsubscribe()
                  this.#effectSubscriptions.delete(uuid)
                },
              }),
            )
            .subscribe({
              complete: () => {
                effectSubscription.unsubscribe()
                didComplete = true
                this.#effectSubscriptions.get(uuid)?.unsubscribe()
                this.#effectSubscriptions.delete(uuid)
              },
              next: (effectAction) => {
                const unsubscribable = this.send(effectAction)

                if (unsubscribable) {
                  unsubscribables.push(unsubscribable)
                }
              },
            })

          if (!didComplete) {
            unsubscribables.push(effectSubscription)
            this.#effectSubscriptions.set(uuid, effectSubscription)
          }
          break
        }
        case 'run': {
          const operation = effect.operation.p
          unsubscribables.push(
            operation((effectAction) => {
              this.send(effectAction)
            })
          )
          break
        }
      }
    }

    this.#isSending = false

    if (unsubscribables.length === 0) {
      return null
    }

    return {
      unsubscribe: () => {
        for (const unsubscribable of unsubscribables) {
          unsubscribable.unsubscribe()
        }
      },
    }
  }
}
