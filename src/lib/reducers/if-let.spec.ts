import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import {
  Effect,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  SomeReducerOf,
  TcaState,
  TestStore,
} from '../..'

test('IfLetReducer', async (t) => {
  class ChildState extends TcaState {
    counter: Property<number> = 0
  }

  type ChildAction = Case<'decrement'> | Case<'increment'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    override body(): SomeReducerOf<ChildState, ChildAction> {
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
    override body(): SomeReducerOf<ParentState, ParentAction> {
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
        () => new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState.make(), () => new ParentReducer())

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
