import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map } from 'rxjs'
import {
  dependency,
  Effect,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  Scope,
  SomeReducerOf,
  TcaState,
  TestScheduler,
  TestStore,
} from '../..'

class CounterState extends TcaState {
  counter: Property<number> = 0
  isTimerOn: Property<boolean> = false
}

type CounterAction =
  | Case<'decrement'>
  | Case<'increment'>
  | Case<'timerTicked'>
  | Case<'toggleTimer'>

const CounterAction = makeEnum<CounterAction>()

class CounterReducer extends Reducer<CounterState, CounterAction> {
  private readonly scheduler = dependency('scheduler')

  override body(): SomeReducerOf<CounterState, CounterAction> {
    return Reduce((state, action) => {
      switch (action.case) {
        case 'decrement':
          state.counter -= 1
          return Effect.none()

        case 'increment':
          state.counter += 1
          return Effect.none()

        case 'timerTicked':
          state.counter += 1
          return Effect.none()

        case 'toggleTimer':
          state.isTimerOn = !state.isTimerOn
          if (state.isTimerOn) {
            return Effect.observable(
              interval(1000, this.scheduler).pipe(
                map(() => CounterAction.timerTicked()),
              ),
            ).cancellable('timer-id')
          } else {
            return Effect.cancel('timer-id')
          }
      }
    })
  }
}

class FeatureA_State extends TcaState {
  value: Property<string> = ''
}

type FeatureA_Action = Case<'append', string> | Case<'replace', string>
const FeatureA_Action = makeEnum<FeatureA_Action>()

class FeatureA_Reducer extends Reducer<FeatureA_State, FeatureA_Action> {
  override body(): SomeReducerOf<FeatureA_State, FeatureA_Action> {
    return Reduce((state, action) => {
      switch (action.case) {
        case 'append':
          state.value += action.p
          return Effect.none()

        case 'replace':
          state.value = action.p
          return Effect.none()
      }
    })
  }
}

class FeatureB_State extends TcaState {
  value: Property<number> = 0
}

type FeatureB_Action = Case<'add', number> | Case<'replace', number>
const FeatureB_Action = makeEnum<FeatureB_Action>()

class FeatureB_Reducer extends Reducer<FeatureB_State, FeatureB_Action> {
  override body(): SomeReducerOf<FeatureB_State, FeatureB_Action> {
    return Reduce((state, action) => {
      switch (action.case) {
        case 'add':
          state.value += action.p
          return Effect.none()

        case 'replace':
          state.value = action.p
          return Effect.none()
      }
    })
  }
}

class FeatureStateProto extends TcaState {}

type FeatureState = FeatureStateProto &
  (Case<'featureA', FeatureA_State> | Case<'featureB', FeatureB_State>)

const FeatureState = makeEnum<FeatureState>({ proto: FeatureStateProto })

type FeatureAction =
  | Case<'featureA', FeatureA_Action>
  | Case<'featureB', FeatureB_Action>

const FeatureAction = makeEnum<FeatureAction>()

class FeatureReducer extends Reducer<FeatureState, FeatureAction> {
  override body(): SomeReducerOf<FeatureState, FeatureAction> {
    return [
      Scope(
        FeatureState('featureA'),
        FeatureAction('featureA'),
        () => new FeatureA_Reducer(),
      ),
      Scope(
        FeatureState('featureB'),
        FeatureAction('featureB'),
        () => new FeatureB_Reducer(),
      ),
    ]
  }
}

class AppState extends TcaState {
  counter: Property<CounterState> = CounterState.make()
  feature: Property<FeatureState> = FeatureState.featureA(FeatureA_State.make())
}

type AppAction =
  | Case<'counter', CounterAction>
  | Case<'feature', FeatureAction>
  | Case<'switchFeature'>

const AppAction = makeEnum<AppAction>()

class AppReducer extends Reducer<AppState, AppAction> {
  override body(): SomeReducerOf<AppState, AppAction> {
    return [
      Reduce((state, action) => {
        switch (action.case) {
          case 'counter':
            return Effect.none()
          case 'feature':
            return Effect.none()
          case 'switchFeature':
            switch (state.feature.case) {
              case 'featureA':
                state.feature = FeatureState.featureB(FeatureB_State.make())
                return Effect.none()
              case 'featureB':
                state.feature = FeatureState.featureA(FeatureA_State.make())
                return Effect.none()
            }
        }
      }),
      Scope(
        KeyPath.for<AppState>().appending('counter'),
        AppAction('counter'),
        () => new CounterReducer(),
      ),
      Scope(
        KeyPath.for<AppState>().appending('feature'),
        AppAction('feature'),
        () => new FeatureReducer(),
      ),
    ]
  }
}

test('Scope, KeyPath', async (t) => {
  const scheduler = new TestScheduler()
  const store = new TestStore(
    AppState.make(),
    () => new AppReducer(),
    (dependencies) => {
      dependencies.scheduler = scheduler
    },
  )

  await store.send(AppAction.counter(CounterAction.increment()), (state) => {
    state.counter.counter = 1
  })

  await store.send(AppAction.counter(CounterAction.toggleTimer()), (state) => {
    state.counter.isTimerOn = true
  })

  scheduler.advance({ by: 3000 })

  await store.receive(
    AppAction.counter(CounterAction.timerTicked()),
    (state) => {
      state.counter.counter = 2
    },
  )

  await store.receive(
    AppAction.counter(CounterAction.timerTicked()),
    (state) => {
      state.counter.counter = 3
    },
  )

  await store.receive(
    AppAction.counter(CounterAction.timerTicked()),
    (state) => {
      state.counter.counter = 4
    },
  )

  await store.send(AppAction.counter(CounterAction.toggleTimer()), (state) => {
    state.counter.isTimerOn = false
  })

  store.complete()
  t.pass()
})

test('Scope, CasePath', async (t) => {
  const scheduler = new TestScheduler()
  const store = new TestStore(
    AppState.make(),
    () => new AppReducer(),
    (dependencies) => {
      dependencies.scheduler = scheduler
    },
  )

  await store.send(
    AppAction.feature(
      FeatureAction.featureA(FeatureA_Action.append('It works')),
    ),
    (state) => {
      state.feature = FeatureState.featureA(
        FeatureA_State.make({ value: 'It works' }),
      )
    },
  )

  await store.send(
    AppAction.feature(FeatureAction.featureA(FeatureA_Action.append('!'))),
    (state) => {
      state.feature = FeatureState.featureA(
        FeatureA_State.make({ value: 'It works!' }),
      )
    },
  )

  await store.send(AppAction.switchFeature(), (state) => {
    state.feature = FeatureState.featureB(FeatureB_State.make())
  })

  await store.send(
    AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(1))),
    (state) => {
      state.feature = FeatureState.featureB(FeatureB_State.make({ value: 1 }))
    },
  )

  await store.send(
    AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(2))),
    (state) => {
      state.feature = FeatureState.featureB(FeatureB_State.make({ value: 3 }))
    },
  )

  store.complete()
  t.pass()
})
