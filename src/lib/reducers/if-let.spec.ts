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
  TcaState,
  TestScheduler,
  TestStore,
} from '../..'

test('IfLetReducer', async (t) => {
  class ChildState extends TcaState {
    counter: Property<number> = 0
  }

  type ChildAction = Case<'decrement'> | Case<'increment'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    body(): ReducerBuilder<ChildState, ChildAction> {
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
    child: Property<ChildState | null> = null
  }

  type ParentAction = Case<'child', ChildAction> | Case<'toggleChild'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()

          case 'toggleChild':
            state.child = state.child === null ? ChildState.make() : null
            return Effect.none()
        }
      }).ifLet(
        KeyPath.for<ParentState>().appending('child'),
        ParentAction('child'),
        new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState.make(), new ParentReducer())

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = ChildState.make()
  })

  await store.send(ParentAction.child(ChildAction.increment()), (state) => {
    state.child = ChildState.make({ counter: 1 })
  })

  await store.send(ParentAction.child(ChildAction.decrement()), (state) => {
    state.child = ChildState.make()
  })

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = null
  })

  store.complete()
  t.pass()
})

test('IfLetReducer, effect cancellation', async (t) => {
  class ChildState extends TcaState {
    count: Property<number> = 0
  }

  type ChildAction = Case<'timerButtonTapped'> | Case<'timerTick'>
  const ChildAction = makeEnum<ChildAction>()

  class Child extends Reducer<ChildState, ChildAction> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<ChildState, ChildAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'timerButtonTapped':
            return Effect.observable(
              interval(1000, this.scheduler).pipe(
                map(() => ChildAction.timerTick()),
              ),
            )

          case 'timerTick':
            state.count += 1
            return Effect.none()
        }
      })
    }
  }

  class ParentState extends TcaState {
    public child: Property<ChildState | null> = null
  }

  type ParentAction = Case<'child', ChildAction> | Case<'toggleChild'>
  const ParentAction = makeEnum<ParentAction>()

  class Parent extends Reducer<ParentState, ParentAction> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()

          case 'toggleChild':
            state.child = state.child === null ? ChildState.make() : null
            return Effect.none()
        }
      }).ifLet(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        new Child(this.scheduler),
      )
    }
  }

  const scheduler = new TestScheduler()
  const store = new TestStore(ParentState.make(), new Parent(scheduler))

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = ChildState.make()
  })

  await store.send(ParentAction.child(ChildAction.timerButtonTapped()))

  scheduler.advance({ by: 2000 })

  await store.receive(ParentAction.child(ChildAction.timerTick()), (state) => {
    state.child = ChildState.make({ count: 1 })
  })

  await store.receive(ParentAction.child(ChildAction.timerTick()), (state) => {
    state.child = ChildState.make({ count: 2 })
  })

  scheduler.advance({ by: 1000 })

  await store.receive(ParentAction.child(ChildAction.timerTick()), (state) => {
    state.child = ChildState.make({ count: 3 })
  })

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = null
  })

  store.complete()
  t.pass()
})
