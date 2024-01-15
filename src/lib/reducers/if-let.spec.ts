import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import {
  Effect,
  KeyPath,
  Reduce,
  Reducer,
  ReducerBuilder,
  TestStore,
} from '../..'

test('IfLetReducer', async (t) => {
  interface ChildState {
    counter: number
  }

  const ChildState = (state: Partial<ChildState> = {}): ChildState => ({
    counter: 0,
    ...state,
  })

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

  interface ParentState {
    child: ChildState | null
  }

  const ParentState = (state: Partial<ParentState> = {}): ParentState => ({
    child: null,
    ...state,
  })

  type ParentAction = Case<'child', ChildAction> | Case<'toggleChild'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()

          case 'toggleChild':
            state.child = state.child === null ? ChildState() : null
            return Effect.none()
        }
      }).ifLet(
        KeyPath.for<ParentState>().appending('child'),
        ParentAction('child'),
        new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState(), new ParentReducer())

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = ChildState()
  })

  await store.send(ParentAction.child(ChildAction.increment()), (state) => {
    state.child = ChildState({ counter: 1 })
  })

  await store.send(ParentAction.child(ChildAction.decrement()), (state) => {
    state.child = ChildState()
  })

  await store.send(ParentAction.toggleChild(), (state) => {
    state.child = null
  })

  store.complete()
  t.pass()
})
