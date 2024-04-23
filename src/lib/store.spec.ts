import { Case, makeEnum } from '@technicated/ts-enums'
import test, { ExecutionContext } from 'ava'
import { immerable, produce } from 'immer'
import { delay, of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import {
  _elements,
  Effect,
  IdentifiedAction,
  IdentifiedArray,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  Scope,
  SomeReducerOf,
  Store,
  TcaState,
} from '..'
import { areEqual, hash } from './internal'
import { RootStore } from './root-store'

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

test('scope, temp test to be refactored 1', (t) => {
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

test('scope, temp test to be refactored 2', (t) => {
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
      public child: ChildState | null = null,
    ) {
      super()
    }
  }

  type ParentAction =
    | Case<'child', ChildAction>
    | Case<'decrement'>
    | Case<'increment'>
    | Case<'populateChild'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): SomeReducerOf<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()
          case 'decrement':
            state.counter -= 1
            if (state.child) {
              state.child.counter -= 1
            }
            return Effect.none()
          case 'increment':
            state.counter += 1
            if (state.child) {
              state.child.counter += 1
            }
            return Effect.none()
          case 'populateChild':
            state.child = new ChildState()
            return Effect.none()
        }
      }).ifLet(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        () => new ChildReducer(),
      )
    }
  }

  const store = new Store(new ParentState(), () => new ParentReducer())
  let childStore = store.ifScope(
    KeyPath.for(ParentState).appending('child'),
    ParentAction('child'),
  )

  t.deepEqual(childStore, null)

  store.send(ParentAction.increment())
  t.deepEqual(store.state, new ParentState(1, null))

  store.send(ParentAction.populateChild())
  t.deepEqual(store.state, new ParentState(1, new ChildState(0)))

  childStore = store.ifScope(
    KeyPath.for(ParentState).appending('child'),
    ParentAction('child'),
  )

  t.notDeepEqual(childStore, null)

  let count = 0
  store.state$.subscribe(() => (count += 1))
  let childCount = 0
  childStore?.state$.subscribe(() => (childCount += 1))

  store.send(ParentAction.child(ChildAction.increment()))
  t.deepEqual(store.state, new ParentState(1, new ChildState(1)))
  t.deepEqual(childStore?.state, new ChildState(1))

  childStore?.send(ChildAction.increment())
  t.deepEqual(store.state, new ParentState(1, new ChildState(2)))
  t.deepEqual(childStore?.state, new ChildState(2))

  t.deepEqual(count, 3)
  t.deepEqual(childCount, 3)
})

test('scope, temp test to be refactored 3', (t) => {
  class ChildState extends TcaState {
    constructor(
      public readonly id = Math.random(),
      public counter = 0,
    ) {
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
      public children = IdentifiedArray.from(
        [],
        (child: ChildState) => child.id,
      ),
    ) {
      super()
    }
  }

  type ParentAction =
    | Case<'children', IdentifiedAction<ChildState['id'], ChildAction>>
    | Case<'decrement'>
    | Case<'increment'>
    | Case<'populateChild'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): SomeReducerOf<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'children':
            return Effect.none()
          case 'decrement':
            state.counter -= 1
            for (const id of state.children.ids) {
              state.children.modifyForId(id, (child) => {
                child.counter -= 1
              })
            }
            return Effect.none()
          case 'increment':
            state.counter += 1
            for (const id of state.children.ids) {
              state.children.modifyForId(id, (child) => {
                child.counter += 1
              })
            }
            return Effect.none()
          case 'populateChild':
            state.children.append(new ChildState())
            return Effect.none()
        }
      }).forEach(
        KeyPath.for(ParentState).appending('children'),
        ParentAction('children'),
        () => new ChildReducer(),
      )
    }
  }

  const store = new Store(new ParentState(), () => new ParentReducer())
  let childStores = store.forEachScope(
    KeyPath.for(ParentState).appending('children'),
    ParentAction('children'),
  )

  class Cls {
    p = IdentifiedArray.from([], (el: { id: number }) => el.id)

    constructor() {
      Object.defineProperty(this, immerable, { value: true })
    }
  }

  const obj = new Cls()
  //  Object.defineProperty(obj.a!.b!, 'c', { enumerable: true, value: new Set() })
  //  t.deepEqual(obj, { a:{ b:{ data:'' } } })

  const res = produce(obj, (draft) => {
    draft.p = IdentifiedArray.from([], (el: { id: number }) => el.id)
  })

  console.log(
    'jaksjkdsakjdaskajdsjkadskj',
    t.deepEqual(res, obj),
    hash(res),
    hash(obj),
    Object.getOwnPropertyNames(res.p),
    Object.getOwnPropertyNames(obj.p),
  )

  console.log('[[[[[imer]]]]]', obj.p, '-', res.p, '-')

  t.deepEqual(childStores.length, 0)

  store.send(ParentAction.increment())
  t.deepEqual(store.state, new ParentState(1, IdentifiedArray.empty()))
  t.true(areEqual(store.state, new ParentState(1, IdentifiedArray.empty())))

  console.log('DBUGGGO [0]', store.state, store.state.children)

  const record = new Set<string>()

  function ignorable<O extends object>(clas: O, prop: keyof O & string) {
    void clas
    void prop

    record.add(prop)
  }

  function custom<O extends { new (...args: any[]): object }>(clas: O) {
    void clas

    for (const p of record) {
      delete clas[p as keyof O]
    }

    return new Proxy(clas, {
      construct(_, args) {
        console.log('construct', arguments)
        const res = new clas(...args)
        const storage: Partial<Record<string, unknown>> = {}
        for (const p of record) {
          storage[p] = res[p as keyof typeof res]
          delete res[p as keyof typeof res]
        }

        return new Proxy(res, {
          get(target, prop) {
            if (prop in target) {
              return target[prop as keyof typeof prop]
            }

            return storage[prop as keyof typeof storage]
          },
          set(target, prop, newValue) {
            if (prop in target) {
              target[prop as keyof typeof prop] = newValue
            }

            storage[prop as keyof typeof storage] = newValue
            return true
          },
        })
      },
      defineProperty() {
        console.log('defineProperty', arguments)
        return undefined as any
      },
    })

    /*class extends clas {
      constructor(...args: any[]) {
        super(...args)

        for (const p of record) {
          let storage = this[p as keyof typeof this]
    
          Object.defineProperty(this, p, {
            configurable: false,
            enumerable: false,
            get() { return storage },
            set(newValue) { storage = newValue },
          })      
        }
      }
    }*/
  }

  @custom
  class Tester {
    public a: string

    @ignorable
    public b: string

    constructor(a: string, b: string) {
      this.a = a
      this.b = b
    }
  }

  const t1 = new Tester('hello', 'gg')
  const t2 = new Tester('hello', 'wp')
  console.log(
    'the maigc?',
    t.deepEqual(t1, t2),
    hash(t1),
    hash(t2),
    Object.getOwnPropertyNames(t1),
    t1.a,
    t1.b,
    t2.a,
    t2.b,
  )
  t2.b = 'andrea'
  console.log('the maigc 2?', t1.a, t1.b, t2.a, t2.b, areEqual(t1, t2))

  store.send(ParentAction.populateChild())
  console.log(
    'DBUGGGO [1]',
    store.state,
    store.state.children,
    (
      (store as unknown as { rootStore: RootStore }).rootStore.state as {
        children: { [_elements]: object }
      }
    ).children[_elements].constructor,
  )
  //t.deepEqual(store.state, new ParentState(1, IdentifiedArray.empty()))
  console.log('access')
  t.true(
    areEqual(
      store.state,
      new ParentState(
        1,
        IdentifiedArray.from([
          new ChildState(store.state.children.get(0)?.id ?? Math.random()),
        ]),
      ),
    ),
  )
  console.log('end access')

  store.send(ParentAction.populateChild())
  // t.deepEqual(store.state, new ParentState(1, IdentifiedArray.empty()))
  t.true(areEqual(store.state, new ParentState(1, IdentifiedArray.empty())))

  childStores = store.forEachScope(
    KeyPath.for(ParentState).appending('children'),
    ParentAction('children'),
  )

  t.deepEqual(childStores.length, 2)

  let count = 0
  store.state$.subscribe(() => (count += 1))
  const childrenCount = [0]
  childStores.forEach((s, idx) =>
    s.state$.subscribe(() => (childrenCount[idx] += 1)),
  )

  store.send(
    ParentAction.children(
      IdentifiedAction.element({
        id: childStores[0].state.id,
        action: ChildAction.increment(),
      }),
    ),
  )
  // t.deepEqual(store.state, new ParentState(1, IdentifiedArray.empty()))
  t.true(areEqual(store.state, new ParentState(1, IdentifiedArray.empty())))
  // t.deepEqual(childStores[0].state, new ChildState(1))
  t.true(areEqual(childStores[0].state, new ChildState(1)))
  // t.deepEqual(childStores[1].state, new ChildState(1))
  t.true(areEqual(childStores[1].state, new ChildState(1)))

  childStores[0].send(ChildAction.increment())
  // t.deepEqual(store.state, new ParentState(1, IdentifiedArray.empty()))
  t.true(areEqual(store.state, new ParentState(1, IdentifiedArray.empty())))
  // t.deepEqual(childStores[0].state, new ChildState(1))
  t.true(areEqual(childStores[0].state, new ChildState(1)))
  // t.deepEqual(childStores[1].state, new ChildState(1))
  t.true(areEqual(childStores[1].state, new ChildState(1)))

  t.deepEqual(count, 3)
  t.deepEqual(childrenCount, [3])
})
