import test from 'ava'
import {
  dependency,
  Injector,
  runInInjectionContext,
  withDependencies,
} from './injector'

test('Injector, run in context', (t) => {
  const instanceCount = {
    dep: 0,
    otherDep: 0,
  }

  class MyOtherDep {
    constructor() {
      instanceCount.otherDep += 1
    }
  }

  class MyDep {
    private readonly otherDep = dependency(MyOtherDep)

    constructor() {
      t.true(
        this.otherDep instanceof MyOtherDep,
        'MyDep, this.otherDep instanceof MyOtherDep',
      )
      instanceCount.dep += 1
    }
  }

  class MyModel {
    private readonly myDep = dependency(MyDep)
    private readonly myOtherDep = dependency(MyOtherDep)

    constructor() {
      t.true(
        this.myDep instanceof MyDep,
        'MyModel, this.myDep instanceof MyDep',
      )
      t.true(
        this.myOtherDep instanceof MyOtherDep,
        'this.myOtherDep instanceof MyOtherDep',
      )
    }
  }

  const injector = new Injector([
    {
      provide: MyDep,
      useClass: MyDep,
    },
    {
      provide: MyOtherDep,
      useClass: MyOtherDep,
    },
  ])

  runInInjectionContext(injector, () => {
    new MyModel()
    new MyModel()
    new MyModel()
  })

  t.is(instanceCount.dep, 1)
  t.is(instanceCount.otherDep, 1)
})

test('Injector, with dependencies', (t) => {
  const instanceCount = {
    dep: 0,
    otherDep: 0,
  }

  class MyOtherDep {
    constructor() {
      instanceCount.otherDep += 1
    }
  }

  class MyDep {
    private readonly otherDep = dependency(MyOtherDep)

    constructor() {
      t.true(
        this.otherDep instanceof MyOtherDep,
        'MyDep, this.otherDep instanceof MyOtherDep',
      )
      instanceCount.dep += 1
    }
  }

  class MyModel {
    private readonly myDep = dependency(MyDep)
    private readonly myOtherDep = dependency(MyOtherDep)

    constructor() {
      t.true(
        this.myDep instanceof MyDep,
        'MyModel, this.myDep instanceof MyDep',
      )
      t.true(
        this.myOtherDep instanceof MyOtherDep,
        'this.myOtherDep instanceof MyOtherDep',
      )
    }
  }

  withDependencies(
    [
      {
        provide: MyDep,
        useClass: MyDep,
      },
      {
        provide: MyOtherDep,
        useClass: MyOtherDep,
      },
    ],
    () => {
      new MyModel()
      new MyModel()
      new MyModel()
    },
  )

  t.is(instanceCount.dep, 1)
  t.is(instanceCount.otherDep, 1)
})
