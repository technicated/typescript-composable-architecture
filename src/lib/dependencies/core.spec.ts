import test from 'ava'
import {
  DependencyKey,
  DependencyValues,
  registerDependency,
  withDependencies,
} from '../..'

class ValueWrapper {
  constructor(public value: string) {}
}

class ValueWrapperDependencyKey implements DependencyKey<ValueWrapper> {
  readonly liveValue = new ValueWrapper('hello, world')
}

declare module '../..' {
  interface DependencyValues {
    ['core.spec.valueWrapper']: ValueWrapper
  }
}

registerDependency('core.spec.valueWrapper', ValueWrapperDependencyKey)

class UuidGeneratorDependencyKey implements DependencyKey<() => string> {
  get liveValue(): () => string {
    let i = 0
    return () => {
      return `00000000-0000-0000-0000-${`${i++}`.padStart(12, '0')}`
    }
  }
}

declare module '../..' {
  interface DependencyValues {
    ['core.spec.uuid']: () => string
  }
}

registerDependency('core.spec.uuid', UuidGeneratorDependencyKey)

test('Dependency registration', (t) => {
  t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'hello, world')
  t.is(
    DependencyValues.current['core.spec.uuid'](),
    '00000000-0000-0000-0000-000000000000',
  )
})

test('Dependency overriding, object replacement', (t) => {
  const outer = DependencyValues.current['core.spec.valueWrapper']

  t.is(outer.value, 'hello, world')
  t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'hello, world')

  withDependencies(
    (dependencies) => {
      dependencies['core.spec.valueWrapper'] = new ValueWrapper('empty')
    },
    () => {
      t.is(outer.value, 'hello, world')
      t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'empty')
    },
  )

  t.is(outer.value, 'hello, world')
  t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'hello, world')
})

test('Dependency overriding, property replacement', (t) => {
  const outer = DependencyValues.current['core.spec.valueWrapper']

  t.is(outer.value, 'hello, world')
  t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'hello, world')

  withDependencies(
    (dependencies) => {
      dependencies['core.spec.valueWrapper'].value = 'empty'
    },
    () => {
      t.is(outer.value, 'hello, world')
      t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'empty')
    },
  )

  t.is(outer.value, 'hello, world')
  t.is(DependencyValues.current['core.spec.valueWrapper'].value, 'hello, world')
})

test('Differences between readonly dependencies and dependencies with getter', (t) => {
  t.false(
    DependencyValues.current['core.spec.uuid'] ===
      DependencyValues.current['core.spec.uuid'],
  )

  t.true(
    DependencyValues.current['core.spec.valueWrapper'] ===
      DependencyValues.current['core.spec.valueWrapper'],
  )

  {
    const uuid = DependencyValues.current['core.spec.uuid']

    t.is(uuid(), '00000000-0000-0000-0000-000000000000')
    t.is(uuid(), '00000000-0000-0000-0000-000000000001')
  }

  {
    const uuid = DependencyValues.current['core.spec.uuid']

    t.is(uuid(), '00000000-0000-0000-0000-000000000000')
    t.is(uuid(), '00000000-0000-0000-0000-000000000001')
  }
})