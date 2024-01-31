import test from 'ava'
import {
  DateGenerator,
  Dependency,
  DependencyContext,
  DependencyKey,
  DependencyValues,
  registerDependency,
  TestDependencyKey,
  withDependencies,
} from '../..'

const missingLiveDependency = 'dependency-values.spec.missingLiveDependency'

declare module '../..' {
  interface DependencyValues {
    [missingLiveDependency]: number
  }
}

class TestKey extends TestDependencyKey<number> {
  readonly testValue = 42
}

registerDependency(missingLiveDependency, TestKey)

const optionalDependency = 'dependency-values.spec.optionalDependency'

declare module '../..' {
  interface DependencyValues {
    [optionalDependency]: string | null
  }
}

class OptionalDependencyKey extends DependencyKey<string | null> {
  readonly liveValue = 'live'

  get testValue(): string | null {
    throw new Error('unimplemented optionalDependency')
  }
}

registerDependency(optionalDependency, OptionalDependencyKey)

class ReuseClient {
  constructor(
    public readonly count: () => number,
    public readonly setCount: (count: number) => void,
  ) {}
}

class ReuseClientKey extends TestDependencyKey<ReuseClient> {
  get testValue(): ReuseClient {
    let count = 0

    return new ReuseClient(
      () => count,
      (newValue) => (count = newValue),
    )
  }
}

const reuseClient = 'dependency-values.spec.reuseClient'

declare module '../..' {
  interface DependencyValues {
    [reuseClient]: ReuseClient
  }
}

registerDependency(reuseClient, ReuseClientKey)

test.beforeEach(() => {
  DependencyValues._current.context = DependencyContext.test
})

const someDate = new Date(1_234_567_890_000)

test.serial('DependencyValues, missing live value', (t) => {
  class Wrapper {
    @Dependency(missingLiveDependency) static missingLiveDependency: number
  }

  t.throws(
    () => {
      withDependencies(
        (dependencies) => {
          dependencies.context = DependencyContext.live
        },
        () => {
          Wrapper.missingLiveDependency
        },
      )
    },
    {
      message: `TestKey has no live implementation, but was accessed from a live context.

Every dependency registered with the library must conform to 'DependencyKey', and that conformance must be visible to the running application.

To fix, make sure that 'TestKey' conforms to 'DependencyKey' by providing a live implementation of your dependency.`,
    },
  )
})

test.serial('DependencyValues, with values', (t) => {
  class Wrapper {
    @Dependency('date') static date: DateGenerator
  }

  const date = withDependencies(
    (dependencies) => {
      dependencies.date = DateGenerator.constant(someDate)
    },
    () => {
      return Wrapper.date.now
    },
  )

  const defaultDate = withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      return Wrapper.date.now
    },
  )

  t.deepEqual(date, someDate)
  t.notDeepEqual(defaultDate, someDate)
})

test.serial('DependencyValues, with value', (t) => {
  class Wrapper {
    @Dependency('date') static date: DateGenerator
  }

  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      const date = withDependencies(
        (dependencies) => {
          dependencies.date = DateGenerator.constant(someDate)
        },
        () => {
          return Wrapper.date.now
        },
      )

      t.deepEqual(date, someDate)
      t.notDeepEqual(DependencyValues._current.date.now, someDate)
    },
  )
})

test.serial('DependencyValues, optional dependency', (t) => {
  class Wrapper {
    @Dependency(optionalDependency) static optionalDependency: string | null
  }

  for (const value of [null, '']) {
    withDependencies(
      (dependencies) => {
        dependencies[optionalDependency] = value
      },
      () => {
        t.is(Wrapper.optionalDependency, value)
      },
    )
  }
})

test.serial('DependencyValues, optional dependency live', (t) => {
  class Wrapper {
    @Dependency(optionalDependency) static optionalDependency: string | null
  }

  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      t.is(Wrapper.optionalDependency, 'live')
    },
  )

  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
      dependencies[optionalDependency] = null
    },
    () => {
      t.is(Wrapper.optionalDependency, null)
    },
  )
})

test.serial('DependencyValues, optional dependency undefined', (t) => {
  class Wrapper {
    @Dependency(optionalDependency) static optionalDependency: string | null
  }

  t.throws(
    () => {
      Wrapper.optionalDependency
    },
    {
      message: 'unimplemented optionalDependency',
    },
  )
})

test.serial('DependencyValues, dependency default is reused', (t) => {
  class Wrapper {
    @Dependency(reuseClient) static reuseClient: ReuseClient
  }

  withDependencies(
    () => {
      return new DependencyValues()
    },
    () => {
      withDependencies(
        (dependencies) => {
          dependencies.context = DependencyContext.test
        },
        () => {
          t.is(Wrapper.reuseClient.count(), 0)
          Wrapper.reuseClient.setCount(42)
          t.is(Wrapper.reuseClient.count(), 42)
        },
      )
    },
  )
})

test.serial(
  'DependencyValues, dependency default is reused, segmented by context',
  (t) => {
    class Wrapper {
      @Dependency(reuseClient) static reuseClient: ReuseClient
    }

    withDependencies(
      () => {
        return new DependencyValues()
      },
      () => {
        withDependencies(
          (dependencies) => {
            dependencies.context = DependencyContext.test
          },
          () => {
            t.is(Wrapper.reuseClient.count(), 0)
            Wrapper.reuseClient.setCount(42)
            t.is(Wrapper.reuseClient.count(), 42)

            withDependencies(
              (dependencies) => {
                dependencies.context = DependencyContext.preview
              },
              () => {
                t.is(Wrapper.reuseClient.count(), 0)
                Wrapper.reuseClient.setCount(1729)
                t.is(Wrapper.reuseClient.count(), 1729)
              },
            )

            t.is(Wrapper.reuseClient.count(), 42)

            withDependencies(
              (dependencies) => {
                dependencies.context = DependencyContext.live
              },
              () => {
                t.throws(
                  () => {
                    Wrapper.reuseClient
                  },
                  {
                    message:
                      /^ReuseClientKey has no live implementation, but was accessed from a live context./,
                  },
                )
              },
            )

            t.is(Wrapper.reuseClient.count(), 42)
          },
        )
      },
    )
  },
)

test.serial('DependencyValues, nested with test values', (t) => {
  withDependencies(
    (dependencies) => {
      dependencies.date.now = new Date(1_234_567_890_000)
    },
    () => {
      withDependencies(
        (dependencies) => {
          dependencies.randomNumberGenerator.next = () => 0.5
        },
        () => {
          t.deepEqual(
            DependencyValues._current.date.now,
            new Date(1_234_567_890_000),
          )
          t.is(DependencyValues._current.randomNumberGenerator.next(), 0.5)
          t.is(DependencyValues._current.context, DependencyContext.test)
        },
      )
    },
  )
})
