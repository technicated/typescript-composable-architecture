import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, of } from 'rxjs'
import {
  dependency,
  Effect,
  EmptyReducer,
  IdentifiedAction,
  IdentifiedArray,
  IdentifiedArrayOf,
  KeyPath,
  Property,
  Reduce,
  Reducer,
  registerDependency,
  SomeReducerOf,
  TcaState,
  TestDependencyKey,
  TestScheduler,
  TestStore,
} from '../..'

interface UuidGenerator {
  generate(): string
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace UuidGenerator {
  export const unimplemented: UuidGenerator = {
    generate(): string {
      throw new Error('unimplemented dependency "uuid"')
    },
  }

  export function constantValue(value: number): string {
    return `00000000-0000-0000-0000-${`${value}`.padStart(12, '0')}`
  }

  export class Incrementing implements UuidGenerator {
    private i = 0

    generate(): string {
      return `00000000-0000-0000-0000-${`${this.i++}`.padStart(12, '0')}`
    }
  }
}

const uuid = Symbol()

declare module '../..' {
  interface DependencyValues {
    [uuid]: UuidGenerator
  }
}

class UuidKey extends TestDependencyKey<UuidGenerator> {
  readonly testValue = UuidGenerator.unimplemented
}

registerDependency(uuid, UuidKey)

test('ForEachReducer, element action', async (t) => {
  class Row extends TcaState {
    constructor(
      public id: number,
      public value: string,
    ) {
      super()
    }
  }

  class ElementState extends TcaState {
    rows: Property<IdentifiedArrayOf<Row>> = IdentifiedArray.empty()
  }

  type ElementAction =
    | Case<'buttonTapped'>
    | Case<'rows', IdentifiedAction<number, string>>
  const ElementAction = makeEnum<ElementAction>()

  class ElementReducer extends Reducer<ElementState, ElementAction> {
    override body(): SomeReducerOf<ElementState, ElementAction> {
      return EmptyReducer().forEach(
        KeyPath.for(ElementState).appending('rows'),
        ElementAction('rows'),
        () =>
          Reduce((state, action) => {
            state.value = action
            return action.length === 0
              ? Effect.observable(of('Empty'))
              : Effect.none()
          }),
      )
    }
  }

  const store = new TestStore(
    ElementState.make({
      rows: IdentifiedArray.from([
        new Row(1, 'Blob'),
        new Row(2, 'Blob Jr.'),
        new Row(3, 'Blob Sr.'),
      ]),
    }),
    () => new ElementReducer(),
  )

  await store.run(async () => {
    await store.send(
      ElementAction.rows(
        IdentifiedAction.element({ id: 1, action: 'Blob Esq.' }),
      ),
      (state) => {
        state.rows.modifyForId(1, (row) => {
          row.value = 'Blob Esq.'
        })
      },
    )

    await store.send(
      ElementAction.rows(IdentifiedAction.element({ id: 2, action: '' })),
      (state) => {
        state.rows.modifyForId(2, (row) => {
          row.value = ''
        })
      },
    )

    await store.receive(
      ElementAction.rows(IdentifiedAction.element({ id: 2, action: 'Empty' })),
      (state) => {
        state.rows.modifyForId(2, (row) => {
          row.value = 'Empty'
        })
      },
    )
  })

  t.pass()
})

test('ForEachReducer, automatic effect cancellation', async (t) => {
  class TimerState extends TcaState {
    constructor(
      public id: string,
      public elapsed: number = 0,
    ) {
      super()
    }
  }

  type TimerAction = Case<'start'> | Case<'tick'>
  const TimerAction = makeEnum<TimerAction>()

  class TimerReducer extends Reducer<TimerState, TimerAction> {
    private readonly scheduler = dependency('scheduler')

    override body(): SomeReducerOf<TimerState, TimerAction> {
      return Reduce((state, action) => {
        switch (action.case) {
          case 'start':
            return Effect.observable(
              interval(1000, this.scheduler).pipe(
                map(() => TimerAction.tick()),
              ),
            )

          case 'tick':
            state.elapsed += 1
            return Effect.none()
        }
      })
    }
  }

  class TimersState extends TcaState {
    constructor(
      public timers: IdentifiedArrayOf<TimerState> = IdentifiedArray.empty(),
    ) {
      super()
    }
  }

  type TimersAction =
    | Case<'addTimer'>
    | Case<'removeLastTimer'>
    | Case<'timers', IdentifiedAction<string, TimerAction>>
  const TimersAction = makeEnum<TimersAction>()

  class TimersReducer extends Reducer<TimersState, TimersAction> {
    private readonly uuid = dependency(uuid)

    override body(): SomeReducerOf<TimersState, TimersAction> {
      return Reduce<TimersState, TimersAction>((state, action) => {
        switch (action.case) {
          case 'addTimer':
            state.timers.append(new TimerState(this.uuid.generate()))
            return Effect.none()

          case 'removeLastTimer':
            state.timers.removeLast()
            return Effect.none()

          case 'timers':
            return Effect.none()
        }
      }).forEach(
        KeyPath.for(TimersState).appending('timers'),
        TimersAction('timers'),
        () => new TimerReducer(),
      )
    }
  }

  const scheduler = new TestScheduler()
  const store = new TestStore(
    TimersState.make(),
    () => new TimersReducer(),
    (dependencies) => {
      dependencies.scheduler = scheduler
      dependencies[uuid] = new UuidGenerator.Incrementing()
    },
  )

  await store.run(async () => {
    await store.send(TimersAction.addTimer(), (state) => {
      state.timers = IdentifiedArray.from([
        new TimerState(UuidGenerator.constantValue(0)),
      ])
    })

    await store.send(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.start(),
        }),
      ),
    )

    scheduler.advance({ by: 2000 })

    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(0, (timer) => {
          timer.elapsed = 1
        })
      },
    )

    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(0, (timer) => {
          timer.elapsed = 2
        })
      },
    )

    await store.send(TimersAction.addTimer(), (state) => {
      state.timers = IdentifiedArray.from([
        new TimerState(UuidGenerator.constantValue(0), 2),
        new TimerState(UuidGenerator.constantValue(1)),
      ])
    })

    scheduler.advance({ by: 1000 })

    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(0, (timer) => {
          timer.elapsed = 3
        })
      },
    )

    await store.send(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(1),
          action: TimerAction.start(),
        }),
      ),
    )

    scheduler.advance({ by: 1000 })
    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(0, (timer) => {
          timer.elapsed = 4
        })
      },
    )

    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(1),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(1, (timer) => {
          timer.elapsed = 1
        })
      },
    )

    await store.send(TimersAction.removeLastTimer(), (state) => {
      state.timers = IdentifiedArray.from([
        new TimerState(UuidGenerator.constantValue(0), 4),
      ])
    })

    scheduler.advance({ by: 1000 })

    await store.receive(
      TimersAction.timers(
        IdentifiedAction.element({
          id: UuidGenerator.constantValue(0),
          action: TimerAction.tick(),
        }),
      ),
      (state) => {
        state.timers.modifyAtIndex(0, (timer) => {
          timer.elapsed = 5
        })
      },
    )

    await store.send(TimersAction.removeLastTimer(), (state) => {
      state.timers = IdentifiedArray.empty()
    })
  })

  t.pass()
})
