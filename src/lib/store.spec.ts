import { Case, makeEnum } from '@technicated/ts-enums'
import test, { ExecutionContext } from 'ava'
import { delay, of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import {
  Effect,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  Scope,
  SomeReducerOf,
  Store,
  TcaState,
} from '..'

class State extends TcaState {
  counter: Property<number> = 0
  isTimerOn: Property<boolean> = false
}

type Action =
  | Case<'decrement'>
  | Case<'delayedIncrement', { delay: number }>
  | Case<'increment'>

const Action = makeEnum<Action>()

class CounterReducer extends Reducer<State, Action> {
  override reduce(state: State, action: Action): Effect<Action> {
    switch (action.case) {
      case 'decrement':
        state.counter -= 1
        return Effect.none()

      case 'delayedIncrement':
        return Effect.observable(
          of(Action.increment()).pipe(delay(action.p.delay)),
        )

      case 'increment':
        state.counter += 1
        return Effect.none()
    }
  }
}

const makeTestScheduler = (t: ExecutionContext<unknown>) =>
  new TestScheduler((actual, expected) => t.deepEqual(actual, expected))

test('Store without effects', (t) => {
  const store = new Store(State.make(), () => new CounterReducer())
  t.deepEqual(store.state, State.make())
  store.send(Action.increment())
  t.deepEqual(store.state, State.make({ counter: 1 }))
  store.send(Action.increment())
  t.deepEqual(store.state, State.make({ counter: 2 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State.make({ counter: 1 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State.make({ counter: 0 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State.make({ counter: -1 }))
})

test('Store with effects', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const store = new Store(State.make(), () => new CounterReducer())

    expectObservable(store.state$).toBe(
      'a 99ms b 99ms c 799ms d 99ms e 399ms f',
      {
        a: State.make({ counter: 0 }),
        b: State.make({ counter: 0 }),
        c: State.make({ counter: 1 }),
        d: State.make({ counter: 1 }),
        e: State.make({ counter: 2 }),
        f: State.make({ counter: 3 }),
      },
    )

    testScheduler.schedule(() => {
      store.send(Action.delayedIncrement({ delay: 1000 }))
    }, 100)

    testScheduler.schedule(() => {
      store.send(Action.increment())
    }, 200)

    testScheduler.schedule(() => {
      store.send(Action.delayedIncrement({ delay: 500 }))
    }, 1000)
  })
})

test('scope, temp test to be refactored', (t) => {
  class ChildState extends TcaState {
    constructor(public counter = 0) {
      super()
    }
  }

  type ChildAction = Case<'decrement'> | Case<'increment'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    body(): SomeReducerOf<ChildState, ChildAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'decrement':
            state.counter -= 1
            return Effect.none()
          case 'increment':
            state.counter += 1
            return Effect.none()
        }
      })
    }
  }

  class ParentState extends TcaState {
    constructor(
      public counter = 0,
      public child: ChildState = new ChildState(),
    ) {
      super()
    }
  }

  type ParentAction =
    | Case<'child', ChildAction>
    | Case<'decrement'>
    | Case<'increment'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): SomeReducerOf<ParentState, ParentAction> {
      return [
        Scope(
          KeyPath.for(ParentState).appending('child'),
          ParentAction('child'),
          () => new ChildReducer(),
        ),
        Reduce<ParentState, ParentAction>((state, action) => {
          switch (action.case) {
            case 'child':
              return Effect.none()
            case 'decrement':
              state.counter -= 1
              state.child.counter -= 1
              return Effect.none()
            case 'increment':
              state.counter += 1
              state.child.counter += 1
              return Effect.none()
          }
        }),
      ]
    }
  }

  const store = new Store(new ParentState(), () => new ParentReducer())
  const childStore = store.scope(
    KeyPath.for(ParentState).appending('child'),
    ParentAction('child'),
  )

  let count = 0
  store.state$.subscribe(() => (count += 1))
  let childCount = 0
  childStore.state$.subscribe(() => (childCount += 1))

  store.send(ParentAction.increment())
  t.deepEqual(store.state, new ParentState(1, new ChildState(1)))
  t.deepEqual(childStore.state, new ChildState(1))

  store.send(ParentAction.child(ChildAction.increment()))
  t.deepEqual(store.state, new ParentState(1, new ChildState(2)))
  t.deepEqual(childStore.state, new ChildState(2))

  childStore.send(ChildAction.increment())
  t.deepEqual(store.state, new ParentState(1, new ChildState(3)))
  t.deepEqual(childStore.state, new ChildState(3))

  t.deepEqual(count, 4)
  t.deepEqual(childCount, 4)
})
