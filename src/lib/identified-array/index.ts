import { immerable } from 'immer'
import {
  areEqual,
  combineInto,
  HasCustomEquality,
  HasCustomHash,
  Hasher,
  isEqualTo,
} from '../internal'

interface Identifiable<ID> {
  id: ID
}

// prettier-ignore
export class IdentifiedArray<ID, Element> implements HasCustomEquality, HasCustomHash
{
  static empty<Element extends Identifiable<unknown>>(): IdentifiedArray<
    Element['id'],
    Element
  >
  static empty<ID, Element>(
    id: (element: Element) => ID,
  ): IdentifiedArray<ID, Element>
  static empty<ID, Element extends Identifiable<ID>>(
    id?: (element: Element) => ID,
  ): IdentifiedArray<ID, Element> {
    return new IdentifiedArray([], id ?? ((element: Element) => element.id))
  }

  static from<Element extends Identifiable<unknown>>(
    elements: Iterable<NonNullable<Element>>,
  ): IdentifiedArray<Element['id'], Element>
  static from<ID, Element>(
    elements: Iterable<NonNullable<Element>>,
    id: (element: Element) => ID,
  ): IdentifiedArray<ID, Element>
  static from<ID, Element extends Identifiable<ID>>(
    elements: Iterable<NonNullable<Element>>,
    id?: (element: Element) => ID,
  ): IdentifiedArray<ID, NonNullable<Element>> {
    return new IdentifiedArray(elements, id ?? ((element) => element.id))
  }

  private _elements = new Map<ID, Element>()
  private _ids: ID[] = []

  get ids(): ID[] {
    return this._ids
  }

  private constructor(
    elements: Iterable<Element>,
    private readonly id: (element: Element) => ID,
  ) {
    Object.assign(this, { [immerable]: true })

    for (const element of elements) {
      const elementId = id(element)
      this._elements.set(elementId, element)
      this._ids.push(elementId)
    }

    Object.defineProperty(this, '_elements', { enumerable: false })
    Object.defineProperty(this, 'id', { enumerable: false })
  }

  append(element: Element): void {
    const elementId = this.id(element)
    this._elements.set(elementId, element)
    this._ids.push(elementId)
  }

  get(index: number): Element | null {
    const elementId = this._ids[index]
    return elementId !== undefined ? this.getById(elementId) : null
  }

  getById(id: ID): Element | null {
    console.log(
      'proto',
      Object.getPrototypeOf(this._elements),
      this._elements.constructor,
    )
    return this._elements.get(id) ?? null
  }

  modifyAtIndex(
    index: number,
    update: (element: Element) => Element | void,
  ): void {
    const elementId = this._ids[index]

    if (elementId) {
      this.modifyForId(elementId, update)
    }
  }

  modifyForId(id: ID, update: (element: Element) => Element | void): void {
    const element = this._elements.get(id)

    if (element) {
      this._elements.set(id, update(element) ?? element)
    }
  }

  removeLast(): void {
    const elementId = this._ids.pop()

    if (elementId) {
      this._elements.delete(elementId)
    }
  }

  [combineInto](hasher: Hasher): void {
    hasher.combine(this._elements)
  }

  [isEqualTo](other: this): boolean {
    return areEqual(this._elements, other._elements)
  }

  *[Symbol.iterator](): Generator<Element> {
    for (const id of this._ids) {
      yield this.getById(id)!
    }
  }
}

export type IdentifiedArrayOf<Element extends Identifiable<unknown>> =
  IdentifiedArray<Element['id'], Element>
