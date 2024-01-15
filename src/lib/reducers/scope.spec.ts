import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, SchedulerLike } from 'rxjs'
import {
  Effect,
  KeyPath,
  Reduce,
  Reducer,
  ReducerBuilder,
  Scope,
  Store,
  TestScheduler,
} from '../..'

interface CounterState {
  counter: number
  isTimerOn: boolean
}

const CounterState = (state: Partial<CounterState> = {}): CounterState => ({
  counter: 0,
  isTimerOn: false,
  ...state,
})

type CounterAction =
  | Case<'decrement'>
  | Case<'increment'>
  | Case<'timerTicked'>
  | Case<'toggleTimer'>

const CounterAction = makeEnum<CounterAction>()

class CounterReducer extends Reducer<CounterState, CounterAction> {
  constructor(private readonly scheduler: SchedulerLike) {
    super()
  }

  body(): ReducerBuilder<CounterState, CounterAction> {
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

interface FeatureA_State {
  value: string
}

const FeatureA_State = (
  state: Partial<FeatureA_State> = {},
): FeatureA_State => ({
  value: '',
  ...state,
})

type FeatureA_Action = Case<'append', string> | Case<'replace', string>
const FeatureA_Action = makeEnum<FeatureA_Action>()

class FeatureA_Reducer extends Reducer<FeatureA_State, FeatureA_Action> {
  body(): ReducerBuilder<FeatureA_State, FeatureA_Action> {
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

interface FeatureB_State {
  value: number
}

const FeatureB_State = (
  state: Partial<FeatureB_State> = {},
): FeatureB_State => ({
  value: 0,
  ...state,
})

type FeatureB_Action = Case<'add', number> | Case<'replace', number>
const FeatureB_Action = makeEnum<FeatureB_Action>()

class FeatureB_Reducer extends Reducer<FeatureB_State, FeatureB_Action> {
  body(): ReducerBuilder<FeatureB_State, FeatureB_Action> {
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

type FeatureState =
  | Case<'featureA', FeatureA_State>
  | Case<'featureB', FeatureB_State>

const FeatureState = makeEnum<FeatureState>()

type FeatureAction =
  | Case<'featureA', FeatureA_Action>
  | Case<'featureB', FeatureB_Action>

const FeatureAction = makeEnum<FeatureAction>()

class FeatureReducer extends Reducer<FeatureState, FeatureAction> {
  body(): ReducerBuilder<FeatureState, FeatureAction> {
    return [
      Scope(
        FeatureState('featureA'),
        FeatureAction('featureA'),
        new FeatureA_Reducer(),
      ),
      Scope(
        FeatureState('featureB'),
        FeatureAction('featureB'),
        new FeatureB_Reducer(),
      ),
    ]
  }
}

interface AppState {
  counter: CounterState
  feature: FeatureState
}

const AppState = (state: Partial<AppState> = {}): AppState => ({
  counter: CounterState(),
  feature: FeatureState.featureA(FeatureA_State()),
  ...state,
})

type AppAction =
  | Case<'counter', CounterAction>
  | Case<'feature', FeatureAction>
  | Case<'switchFeature'>

const AppAction = makeEnum<AppAction>()

class AppReducer extends Reducer<AppState, AppAction> {
  constructor(private readonly scheduler: SchedulerLike) {
    super()
  }

  body(): ReducerBuilder<AppState, AppAction> {
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
                state.feature = FeatureState.featureB(FeatureB_State())
                return Effect.none()
              case 'featureB':
                state.feature = FeatureState.featureA(FeatureA_State())
                return Effect.none()
            }
        }
      }),
      Scope(
        KeyPath.for<AppState>().appending('counter'),
        AppAction('counter'),
        new CounterReducer(this.scheduler),
      ),
      Scope(
        KeyPath.for<AppState>().appending('feature'),
        AppAction('feature'),
        new FeatureReducer(),
      ),
    ]
  }
}

test('Scope, KeyPath', (t) => {
  const scheduler = new TestScheduler()
  const store = new Store(AppState(), new AppReducer(scheduler))
  t.deepEqual(store.state, AppState())

  store.send(AppAction.counter(CounterAction.increment()))
  t.deepEqual(store.state, AppState({ counter: CounterState({ counter: 1 }) }))

  store.send(AppAction.counter(CounterAction.toggleTimer()))
  scheduler.advance({ by: 3000 })
  t.deepEqual(
    store.state,
    AppState({ counter: CounterState({ counter: 4, isTimerOn: true }) }),
  )

  store.send(AppAction.counter(CounterAction.toggleTimer()))
  t.deepEqual(store.state, AppState({ counter: CounterState({ counter: 4 }) }))
})

test('Scope, CasePath', (t) => {
  const scheduler = new TestScheduler()
  const store = new Store(AppState(), new AppReducer(scheduler))
  t.deepEqual(store.state, AppState())

  store.send(
    AppAction.feature(
      FeatureAction.featureA(FeatureA_Action.append('It works')),
    ),
  )
  store.send(
    AppAction.feature(FeatureAction.featureA(FeatureA_Action.append('!'))),
  )
  t.deepEqual(
    store.state,
    AppState({
      feature: FeatureState.featureA(FeatureA_State({ value: 'It works!' })),
    }),
  )

  store.send(AppAction.switchFeature())
  t.deepEqual(
    store.state,
    AppState({ feature: FeatureState.featureB(FeatureB_State()) }),
  )

  store.send(AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(1))))
  store.send(AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(2))))
  t.deepEqual(
    store.state,
    AppState({ feature: FeatureState.featureB(FeatureB_State({ value: 3 })) }),
  )
})
