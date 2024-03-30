import test from 'ava'
import { KeyPath } from '../..'
import * as kp3 from './key-path-3'

interface Pet {
  name: string
}

interface User {
  age: number
  friends: User[]
  name: string
  pet: Pet
}

const makeUser = (user: Partial<User> = {}): User => ({
  age: 31,
  friends: [],
  name: 'Blob',
  pet: { name: 'Mr. PurrPurr' },
  ...user,
})

const makeBlobJr = () =>
  makeUser({
    age: 10,
    friends: [],
    name: 'Blob Jr.',
    pet: { name: 'Doggo' },
  })

const makeBlobSr = () =>
  makeUser({
    age: 42,
    friends: [],
    name: 'Blob Sr.',
    pet: { name: 'Mrs. Birdie' },
  })

test('KeyPath, reading', (t) => {
  const blobSr = makeBlobSr()
  const user = makeUser({ friends: [blobSr] })

  const rootKp = KeyPath.for<User>()
  const ageKp = rootKp.appending('age')
  const friendsKp = rootKp.appending('friends')
  const nameKp = rootKp.appending('name')
  const petKp = rootKp.appending('pet')
  const petNameKp = petKp.appending('name')

  t.deepEqual(rootKp.get(user), user)
  t.deepEqual(ageKp.get(user), 31)
  t.deepEqual(friendsKp.get(user), [blobSr])
  t.deepEqual(nameKp.get(user), 'Blob')
  t.deepEqual(petKp.get(user), { name: 'Mr. PurrPurr' })
  t.deepEqual(petNameKp.get(user), 'Mr. PurrPurr')
})

test('KeyPath, writing terminal property', (t) => {
  const user = makeUser()

  const rootKp = KeyPath.for<User>()
  const ageKp = rootKp.appending('age')
  const friendsKp = rootKp.appending('friends')
  const nameKp = rootKp.appending('name')
  const petKp = rootKp.appending('pet')
  const petNameKp = petKp.appending('name')

  ageKp.set(user, 10)
  friendsKp.set(user, [])
  nameKp.set(user, 'Blob Jr.')
  petNameKp.set(user, 'Doggo')

  t.deepEqual(user, makeBlobJr())
})

test('KeyPath, writing intermediate property', (t) => {
  const user = makeUser()

  const rootKp = KeyPath.for<User>()
  const friendsKp = rootKp.appending('friends')
  const firstFriendKp = friendsKp.appending(0)
  const petKp = rootKp.appending('pet')

  firstFriendKp.set(user, makeBlobSr())
  petKp.set(user, { name: 'Jerry' })

  t.deepEqual(
    user,
    makeUser({
      friends: [makeBlobSr()],
      pet: { name: 'Jerry' },
    }),
  )
})

test('KeyPath, writing root', (t) => {
  const user = makeUser()

  const rootKp = KeyPath.for<User>()

  rootKp.set(user, makeBlobSr())

  t.deepEqual(user, makeBlobSr())
})

test('KeyPath, modify returning value', (t) => {
  const user = makeUser()

  const rootKp = KeyPath.for<User>()
  const nameKp = rootKp.appending('name')
  const petKp = rootKp.appending('pet')

  nameKp.modify(user, (name) => `${name}!`)
  petKp.modify(user, (pet) => ({ name: `${pet.name}!` }))

  t.deepEqual(
    user,
    makeUser({
      name: 'Blob!',
      pet: { name: 'Mr. PurrPurr!' },
    }),
  )
})

test('KeyPath, modify editing value', (t) => {
  const user = makeUser({ friends: [makeBlobSr()] })

  const rootKp = KeyPath.for<User>()
  const friendsKp = rootKp.appending('friends')
  const petKp = rootKp.appending('pet')

  friendsKp.modify(user, (friends) => {
    friends.push(makeBlobJr())
  })

  petKp.modify(user, (pet) => {
    pet.name = 'Jerry'
  })

  t.deepEqual(
    user,
    makeUser({
      friends: [makeBlobSr(), makeBlobJr()],
      pet: { name: 'Jerry' },
    }),
  )
})

test('kp3', (t) => {
  class Pet {
    constructor(
      public name: string,
      public owner: User,
    ) {}
  }

  class User {
    constructor(
      public name: string,
      public friends: User[],
      public mam: [User, User],
      public pet: Pet,
    ) {}
  }
  /*
  const val1 = kp3.KeyPath(User)
  const val2 = val1.name
  const val3 = val1.friends
  const val4 = val1.mam[0].mam[0]
  const val5 = val1.mam[0].mam[1].pet

  void val1
  void val2
  void val3
  void val4
  void val5*/

  const u = new User(
    'user',
    [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Pet('a', undefined as any),
  )

  kp3.KeyPath(User).pet[kp3.set](u, new Pet('b', u))

  t.falsy(u)

  t.fail('nope')
})
