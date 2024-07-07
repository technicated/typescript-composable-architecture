import { Case, HKT, makeEnum1 } from '@technicated/ts-enums'
import { EMPTY, map, merge, Observable, share, Unsubscribable } from 'rxjs'

type Send<Action> = (action: Action) => void

type EffectOperation<Action> =
  | Case<'none'>
  | Case<'observable', Observable<Action>>
  | Case<'run', (send: Send<Action>) => Unsubscribable>

interface EffectOperationHKT extends HKT {
  readonly type: EffectOperation<this['_A']>
}

const EffectOperation = makeEnum1<EffectOperationHKT>()

export class Effect<Action> {
  static merge<Action>(effects: Array<Effect<Action>>): Effect<Action> {
    return effects.reduce(
      (effects, effect) => effects.merge(effect),
      Effect.none(),
    )
  }

  static none<Action>(): Effect<Action> {
    return new Effect(EffectOperation.none())
  }

  static observable<Action>(source: Observable<Action>): Effect<Action> {
    return new Effect(EffectOperation.observable(source))
  }

  static run<Action>(
    operation: (send: Send<Action>) => Unsubscribable,
  ): Effect<Action> {
    return new Effect(EffectOperation.run(operation))
  }

  private constructor(public readonly operation: EffectOperation<Action>) {}

  map<NewAction>(transform: (action: Action) => NewAction): Effect<NewAction> {
    switch (this.operation.case) {
      case 'none':
        return Effect.none()
      case 'observable':
        return Effect.observable(this.operation.p.pipe(map(transform)))
      case 'run': {
        const operation = this.operation.p
        return Effect.run((send) => {
          return operation((action) => {
            send(transform(action))
          })
        })
      }
    }
  }

  merge(other: Effect<Action>): Effect<Action> {
    if (this.operation.case === 'none') {
      return other
    }

    if (other.operation.case === 'none') {
      return this
    }

    if (
      this.operation.case === 'observable' ||
      other.operation.case === 'observable'
    ) {
      return Effect.observable(merge(this.toObservable(), other.toObservable()))
    }

    const thisOperation = this.operation.p
    const otherOperation = other.operation.p

    return Effect.run((send) => {
      const thisUnsubscribable = thisOperation(send)
      const otherUnsubscribable = otherOperation(send)

      return {
        unsubscribe: () => {
          thisUnsubscribable.unsubscribe()
          otherUnsubscribable.unsubscribe()
        },
      }
    })
  }

  toObservable(): Observable<Action> {
    switch (this.operation.case) {
      case 'none':
        return EMPTY
      case 'observable':
        return this.operation.p
      case 'run': {
        const operation = this.operation.p
        return new Observable<Action>((subscriber) => {
          return operation((action) => subscriber.next(action))
        }).pipe(share())
      }
    }
  }
}
