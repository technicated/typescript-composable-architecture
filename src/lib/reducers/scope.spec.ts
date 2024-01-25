import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, SchedulerLike } from 'rxjs'
import {
  Effect,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  ReducerBuilder,
  Scope,
  Store,
  TcaState,
  TestScheduler,
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

class FeatureA_State extends TcaState {
  value: Property<string> = ''
}

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

class FeatureB_State extends TcaState {
  value: Property<number> = 0
}

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

class FeatureStateProto extends TcaState {}

type FeatureState = FeatureStateProto &
  (Case<'featureA', FeatureA_State> | Case<'featureB', FeatureB_State>)

const FeatureState = makeEnum<FeatureState>({ proto: FeatureStateProto })

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
  const store = new Store(AppState.make(), new AppReducer(scheduler))
  t.deepEqual(store.state, AppState.make())

  store.send(AppAction.counter(CounterAction.increment()))
  t.deepEqual(
    store.state,
    AppState.make({ counter: CounterState.make({ counter: 1 }) }),
  )

  store.send(AppAction.counter(CounterAction.toggleTimer()))
  scheduler.advance({ by: 3000 })
  t.deepEqual(
    store.state,
    AppState.make({
      counter: CounterState.make({ counter: 4, isTimerOn: true }),
    }),
  )

  store.send(AppAction.counter(CounterAction.toggleTimer()))
  t.deepEqual(
    store.state,
    AppState.make({ counter: CounterState.make({ counter: 4 }) }),
  )
})

test('Scope, CasePath', (t) => {
  const scheduler = new TestScheduler()
  const store = new Store(AppState.make(), new AppReducer(scheduler))
  t.deepEqual(store.state, AppState.make())

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
    AppState.make({
      feature: FeatureState.featureA(
        FeatureA_State.make({ value: 'It works!' }),
      ),
    }),
  )

  store.send(AppAction.switchFeature())
  t.deepEqual(
    store.state,
    AppState.make({ feature: FeatureState.featureB(FeatureB_State.make()) }),
  )

  store.send(AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(1))))
  store.send(AppAction.feature(FeatureAction.featureB(FeatureB_Action.add(2))))
  t.deepEqual(
    store.state,
    AppState.make({
      feature: FeatureState.featureB(FeatureB_State.make({ value: 3 })),
    }),
  )
})
