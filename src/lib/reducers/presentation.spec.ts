import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, SchedulerLike } from 'rxjs'
import {
  Effect,
  EmptyReducer,
  KeyPath,
  PresentationAction,
  PresentationState,
  Property,
  Reduce,
  Reducer,
  ReducerBuilder,
  Scope,
  TcaState,
  TestScheduler,
  TestStore,
} from '../..'

test('PresentationReducer, parent dismissal', async (t) => {
  class ChildState extends TcaState {
    count: Property<number> = 0
  }

  type ChildAction = Case<'decrement'> | Case<'increment'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    body(): ReducerBuilder<ChildState, ChildAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'decrement':
            state.count -= 1
            return Effect.none()
          case 'increment':
            state.count += 1
            return Effect.none()
        }
      })
    }
  }

  class ParentState extends TcaState {
    child: Property<PresentationState<ChildState>> =
      PresentationState<ChildState>(null)
  }

  type ParentAction =
    | Case<'child', PresentationAction<ChildAction>>
    | Case<'presentChild'>

  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()
          case 'presentChild':
            state.child.wrappedValue = ChildState.make()
            return Effect.none()
        }
      }).presentation(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState.make(), new ParentReducer())

  await store.send(ParentAction.presentChild(), (state) => {
    state.child.wrappedValue = ChildState.make()
  })

  await store.send(
    ParentAction.child(PresentationAction.presented(ChildAction.increment())),
    (state) => {
      state.child.wrappedValue = ChildState.make({ count: 1 })
    },
  )

  await store.send(
    ParentAction.child(PresentationAction.dismiss()),
    (state) => {
      state.child.wrappedValue = null
    },
  )

  store.complete()
  t.pass()
})

test('PresentationReducer, parent dismissal (null out)', async (t) => {
  class ChildState extends TcaState {
    count: Property<number> = 0
  }

  type ChildAction = Case<'decrement'> | Case<'increment'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    body(): ReducerBuilder<ChildState, ChildAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'decrement':
            state.count -= 1
            return Effect.none()
          case 'increment':
            state.count += 1
            return Effect.none()
        }
      })
    }
  }

  class ParentState extends TcaState {
    child: Property<PresentationState<ChildState>> =
      PresentationState<ChildState>(null)
  }

  type ParentAction =
    | Case<'child', PresentationAction<ChildAction>>
    | Case<'dismissChild'>
    | Case<'presentChild'>

  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()
          case 'dismissChild':
            state.child.wrappedValue = null
            return Effect.none()
          case 'presentChild':
            state.child.wrappedValue = ChildState.make()
            return Effect.none()
        }
      }).presentation(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState.make(), new ParentReducer())

  await store.send(ParentAction.presentChild(), (state) => {
    state.child.wrappedValue = ChildState.make()
  })

  await store.send(
    ParentAction.child(PresentationAction.presented(ChildAction.increment())),
    (state) => {
      state.child.wrappedValue = ChildState.make({ count: 1 })
    },
  )

  await store.send(ParentAction.dismissChild(), (state) => {
    state.child.wrappedValue = null
  })

  store.complete()
  t.pass()
})

test('PresentationReducer, parent dismissal + effects', async (t) => {
  class ChildState extends TcaState {
    count: Property<number> = 0
  }

  type ChildAction = Case<'start'> | Case<'tick'>
  const ChildAction = makeEnum<ChildAction>()

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<ChildState, ChildAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'start':
            return Effect.observable(
              interval(1000, this.scheduler).pipe(
                map(() => ChildAction.tick()),
              ),
            )
          case 'tick':
            state.count += 1
            return Effect.none()
        }
      })
    }
  }

  class ParentState extends TcaState {
    child: Property<PresentationState<ChildState>> =
      PresentationState<ChildState>(null)
  }

  type ParentAction =
    | Case<'child', PresentationAction<ChildAction>>
    | Case<'presentChild'>

  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()
          case 'presentChild':
            state.child.wrappedValue = ChildState.make()
            return Effect.none()
        }
      }).presentation(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        new ChildReducer(this.scheduler),
      )
    }
  }

  const scheduler = new TestScheduler()
  const store = new TestStore(ParentState.make(), new ParentReducer(scheduler))

  await store.send(ParentAction.presentChild(), (state) => {
    state.child.wrappedValue = ChildState.make()
  })

  await store.send(
    ParentAction.child(PresentationAction.presented(ChildAction.start())),
  )

  scheduler.advance({ by: 2000 })

  await store.send(
    ParentAction.child(PresentationAction.presented(ChildAction.tick())),
    (state) => {
      state.child.wrappedValue = ChildState.make({ count: 1 })
    },
  )

  await store.send(
    ParentAction.child(PresentationAction.presented(ChildAction.tick())),
    (state) => {
      state.child.wrappedValue = ChildState.make({ count: 2 })
    },
  )

  await store.send(
    ParentAction.child(PresentationAction.dismiss()),
    (state) => {
      state.child.wrappedValue = null
    },
  )

  store.complete()
  t.pass()
})

test('PresentationReducer, child dismissal + effects', async (t) => {
  t.pass('todo: after implementing dependencies')
})

test('PresentationReducer, leave presented', async (t) => {
  class ChildState extends TcaState {}
  type ChildAction = null

  class ChildReducer extends Reducer<ChildState, ChildAction> {
    body(): ReducerBuilder<ChildState, ChildAction> {
      return EmptyReducer()
    }
  }

  class ParentState extends TcaState {
    child: Property<PresentationState<ChildState>> =
      PresentationState<ChildState>(null)
  }

  type ParentAction =
    | Case<'child', PresentationAction<ChildAction>>
    | Case<'presentChild'>
  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'child':
            return Effect.none()

          case 'presentChild':
            state.child.wrappedValue = ChildState.make()
            return Effect.none()
        }
      }).presentation(
        KeyPath.for(ParentState).appending('child'),
        ParentAction('child'),
        new ChildReducer(),
      )
    }
  }

  const store = new TestStore(ParentState.make(), new ParentReducer())

  await store.send(ParentAction.presentChild(), (state) => {
    state.child.wrappedValue = ChildState.make()
  })

  store.complete()
  t.pass()
})

test('PresentationReducer, enum presentation', async (t) => {
  class Feature1_State extends TcaState {
    counter: Property<number> = 0
  }

  type Feature1_Action = Case<'startTimer'> | Case<'tick'>
  const Feature1_Action = makeEnum<Feature1_Action>()

  class Feature1 extends Reducer<Feature1_State, Feature1_Action> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<Feature1_State, Feature1_Action> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'startTimer':
            return Effect.observable(
              interval(1000, this.scheduler).pipe(
                map(() => Feature1_Action.tick()),
              ),
            )
          case 'tick':
            state.counter += 1
            return Effect.none()
        }
      })
    }
  }

  class Feature2_State extends TcaState {}

  type Feature2_Action = Case<'deleteButtonTapped'>
  const Feature2_Action = makeEnum<Feature2_Action>()

  class Feature2 extends Reducer<Feature2_State, Feature2_Action> {
    body(): ReducerBuilder<Feature2_State, Feature2_Action> {
      return Reduce((state, action) => {
        void state

        switch (action.case) {
          case 'deleteButtonTapped':
            return Effect.none()
        }
      })
    }
  }

  class DestinationStateProto extends TcaState {}

  type DestinationState = DestinationStateProto &
    (Case<'feature1', Feature1_State> | Case<'feature2', Feature2_State>)

  const DestinationState = makeEnum<DestinationState>({
    proto: DestinationStateProto,
  })

  type DestinationAction =
    | Case<'feature1', Feature1_Action>
    | Case<'feature2', Feature2_Action>

  const DestinationAction = makeEnum<DestinationAction>()

  class DestinationReducer extends Reducer<
    DestinationState,
    DestinationAction
  > {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<DestinationState, DestinationAction> {
      return [
        Scope(
          DestinationState('feature1'),
          DestinationAction('feature1'),
          new Feature1(this.scheduler),
        ),
        Scope(
          DestinationState('feature2'),
          DestinationAction('feature2'),
          new Feature2(),
        ),
      ]
    }
  }

  class ParentState extends TcaState {
    destination: Property<PresentationState<DestinationState>> =
      PresentationState<DestinationState>(null)
    isDeleted: Property<boolean> = false
  }

  type ParentAction =
    | Case<'destination', PresentationAction<DestinationAction>>
    | Case<'presentFeature1'>
    | Case<'presentFeature2'>

  const ParentAction = makeEnum<ParentAction>()

  class ParentReducer extends Reducer<ParentState, ParentAction> {
    constructor(private readonly scheduler: SchedulerLike) {
      super()
    }

    body(): ReducerBuilder<ParentState, ParentAction> {
      return Reduce<ParentState, ParentAction>((state, action) => {
        switch (action.case) {
          case 'destination':
            if (
              action.p.case === 'presented' &&
              action.p.p.case === 'feature2' &&
              action.p.p.p.case === 'deleteButtonTapped'
            ) {
              state.destination.wrappedValue = null
              state.isDeleted = true
            }

            return Effect.none()
          case 'presentFeature1':
            state.destination.wrappedValue = DestinationState.feature1(
              Feature1_State.make(),
            )
            return Effect.none()
          case 'presentFeature2':
            state.destination.wrappedValue = DestinationState.feature2(
              Feature2_State.make(),
            )
            return Effect.none()
        }
      }).presentation(
        KeyPath.for(ParentState).appending('destination'),
        ParentAction('destination'),
        new DestinationReducer(this.scheduler),
      )
    }
  }

  const scheduler = new TestScheduler()
  const store = new TestStore(ParentState.make(), new ParentReducer(scheduler))

  await store.send(ParentAction.presentFeature1(), (state) => {
    state.destination.wrappedValue = DestinationState.feature1(
      Feature1_State.make(),
    )
  })

  await store.send(
    ParentAction.destination(
      PresentationAction.presented(
        DestinationAction.feature1(Feature1_Action.startTimer()),
      ),
    ),
  )

  scheduler.advance({ by: 2000 })

  await store.receive(
    ParentAction.destination(
      PresentationAction.presented(
        DestinationAction.feature1(Feature1_Action.tick()),
      ),
    ),
    (state) => {
      state.destination.wrappedValue = DestinationState.feature1(
        Feature1_State.make({ counter: 1 }),
      )
    },
  )

  await store.receive(
    ParentAction.destination(
      PresentationAction.presented(
        DestinationAction.feature1(Feature1_Action.tick()),
      ),
    ),
    (state) => {
      state.destination.wrappedValue = DestinationState.feature1(
        Feature1_State.make({ counter: 2 }),
      )
    },
  )

  await store.send(ParentAction.presentFeature2(), (state) => {
    state.destination.wrappedValue = DestinationState.feature2(
      Feature2_State.make(),
    )
  })

  await store.send(
    ParentAction.destination(
      PresentationAction.presented(
        DestinationAction.feature2(Feature2_Action.deleteButtonTapped()),
      ),
    ),
    (state) => {
      state.destination.wrappedValue = null
      state.isDeleted = true
    },
  )

  store.complete()
  t.pass()
})
