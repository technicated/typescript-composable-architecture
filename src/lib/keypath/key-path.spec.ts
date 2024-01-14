import test from 'ava'
import { KeyPath } from '../..'

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
