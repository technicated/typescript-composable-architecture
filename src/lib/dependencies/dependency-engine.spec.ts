import test from 'ava'
import { dependency } from './dependency'
import { getDependencyEngine } from './dependency-engine'

class Magic {
  constructor(public value: number) {}
}

test('eng', (t) => {
  const engine = getDependencyEngine()
  t.throws(() => dependency(Magic))

  const magic = engine.withDependencies(
    new Map([[Magic, new Magic(42)]]),
    () => {
      const magic = dependency(Magic)
      t.deepEqual(magic, new Magic(42))
      magic.value = -1
      t.deepEqual(magic, new Magic(-1))
      t.deepEqual(dependency(Magic), new Magic(-1))

      engine.withDependencies(new Map(), () => {
        t.deepEqual(dependency(Magic), new Magic(-1))
        t.deepEqual(magic, new Magic(-1))

        engine.withDependencies(new Map([[Magic, new Magic(18)]]), () => {
          t.deepEqual(dependency(Magic), new Magic(18))
          t.deepEqual(magic, new Magic(18))
        })

        t.deepEqual(dependency(Magic), new Magic(-1))
      })

      return magic
    },
  )

  t.throws(() => magic)

  t.throws(() => dependency(Magic))
})
