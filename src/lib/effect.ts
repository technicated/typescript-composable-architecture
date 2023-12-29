import { map, Observable } from 'rxjs'

export class Effect<Action> {
  static observable<Action>(source: Observable<Action>): Effect<Action> {
    return new Effect(source)
  }

  static none(): Effect<never> {
    return new Effect()
  }

  private constructor(public readonly source?: Observable<Action>) {}

  map<U>(transform: (action: Action) => U): Effect<U> {
    return this.source
      ? new Effect(this.source.pipe(map(transform)))
      : new Effect()
  }
}
