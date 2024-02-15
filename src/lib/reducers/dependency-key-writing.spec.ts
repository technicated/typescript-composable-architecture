import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { defer, delay, of } from 'rxjs'
import {
  buildReducer,
  Dependency,
  DependencyKey,
  Effect,
  Reduce,
  Reducer,
  ReducerBuilder,
  registerDependency,
  TcaState,
  TestStore,
} from '../..'

// todo: remove from here

class CombineReducer<State extends TcaState, Action> extends Reducer<
  State,
  Action
> {
  private readonly reducer: Reducer<State, Action>

  constructor(reducer: ReducerBuilder<State, Action>) {
    super()
    this.reducer = buildReducer(reducer)
  }

  reduce(state: State, action: Action): Effect<Action> {
    return this.reducer.reduce(state, action)
  }
}

interface WrappedNumber {
  wrappedValue: number
}

const myValue = 'dependency-key-writing-reducer.spec.myValue'

declare module '../..' {
  interface DependencyValues {
    [myValue]: WrappedNumber
  }
}

class MyValueKey extends DependencyKey<WrappedNumber> {
  readonly liveValue = { wrappedValue: 0 }
  readonly testValue = { wrappedValue: 0 }
}

registerDependency(myValue, MyValueKey)

class FeatureState extends TcaState {
  value = 0
}

type FeatureAction = Case<'tap'>
const FeatureAction = makeEnum<FeatureAction>()

class Feature extends Reducer<FeatureState, FeatureAction> {
  @Dependency(myValue)
  readonly myValue!: WrappedNumber

  body(): ReducerBuilder<FeatureState, FeatureAction> {
    return Reduce((state, action) => {
      switch (action.case) {
        case 'tap':
          state.value = this.myValue.wrappedValue
          return Effect.none()
      }
    })
  }
}

test('DependencyKeyWritingReducer, writing fusion order', async (t) => {
  const store = new TestStore(new FeatureState(), [
    new Feature()
      .dependency(myValue, { wrappedValue: 42 })
      .dependency(myValue, { wrappedValue: 1729 }),
  ])

  await store.send(FeatureAction.tap(), (state) => {
    state.value = 42
  })

  store.complete()
  t.pass()
})

test('DependencyKeyWritingReducer, transform fusion order', async (t) => {
  const store = new TestStore(new FeatureState(), [
    new Feature()
      .transformDependency(myValue, (dep) => (dep.wrappedValue = 42))
      .transformDependency(myValue, (dep) => (dep.wrappedValue = 1729)),
  ])

  await store.send(FeatureAction.tap(), (state) => {
    state.value = 42
  })

  store.complete()
  t.pass()
})

test('DependencyKeyWritingReducer, writing order', async (t) => {
  const store = new TestStore(new FeatureState(), [
    new CombineReducer(
      new Feature().dependency(myValue, { wrappedValue: 42 }),
    ).dependency(myValue, { wrappedValue: 1729 }),
  ])

  await store.send(FeatureAction.tap(), (state) => {
    state.value = 42
  })

  store.complete()
  t.pass()
})

test('DependencyKeyWritingReducer, transform order', async (t) => {
  const store = new TestStore(new FeatureState(), [
    new CombineReducer(
      new Feature().transformDependency(
        myValue,
        (dep) => (dep.wrappedValue = 42),
      ),
    ).transformDependency(myValue, (dep) => (dep.wrappedValue = 1729)),
  ])

  await store.send(FeatureAction.tap(), (state) => {
    state.value = 42
  })

  store.complete()
  t.pass()
})

test('DependencyKeyWritingReducer, effect of effect', async (t) => {
  class EffectOfEffectState extends TcaState {
    count = 0
  }

  type EffectOfEffectAction =
    | Case<'tap'>
    | Case<'response'>
    | Case<'otherResponse', number>
  const EffectOfEffectAction = makeEnum<EffectOfEffectAction>()

  class EffectOfEffectReducer extends Reducer<
    EffectOfEffectState,
    EffectOfEffectAction
  > {
    @Dependency(myValue)
    readonly myValue!: WrappedNumber

    body(): ReducerBuilder<EffectOfEffectState, EffectOfEffectAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'tap':
            state.count += 1
            return Effect.observable(
              // defer(() => {
              //   return of(
              //     EffectOfEffectAction.response(),
              //   )
              // }),
              of(EffectOfEffectAction.response()).pipe(
                delay(1000),
              )
            )

          case 'response':
            state.count = this.myValue.wrappedValue
            return Effect.observable(
              defer(() => {
                return of(
                  EffectOfEffectAction.otherResponse(this.myValue.wrappedValue),
                )
              }),
            )

          case 'otherResponse':
            state.count = action.p
            return Effect.none()
        }
      })
    }
  }

  const store = new TestStore(new EffectOfEffectState(), [
    new EffectOfEffectReducer().dependency(myValue, { wrappedValue: 42 }),
  ])

  await store.send(EffectOfEffectAction.tap(), (state) => {
    state.count = 1
  })

  await new Promise((resolve) => setTimeout(resolve, 1500))

  await store.receive(EffectOfEffectAction.response(), (state) => {
    state.count = 42
  })

  await store.receive(EffectOfEffectAction.otherResponse(42))

  store.complete()
  t.pass()
})
