import { useEffect, useState } from 'react';
import { cloneDeep, debounce, isNil, isNumber, isBoolean, isString } from 'lodash';
import asyncStorage from '@react-native-community/async-storage';
import ReactDOM from 'react-dom';
import * as IGlobalState from './GlobalStoreTypes';

export const isPrimitive = <T>(value: T) => {
  return isNil(value) || isNumber(value) || isBoolean(value) || isString(value) || typeof value === 'symbol';
};

export class GlobalStore<
  IState,
  IPersist extends string | null = null,
  IsPersist extends boolean = IPersist extends null ? false : true,
  IActions extends IGlobalState.IActionCollection<IState, IsPersist> | null = null
> implements IGlobalState.IGlobalStateFactory<IState, IPersist, IsPersist, IActions> {
  public subscribers: IGlobalState.StateSetter<IState>[] = [];

  public get isPersistStore(): boolean {
    return !!this.persistStoreAs;
  }

  constructor(protected state: IState, protected actions: IActions = null as IActions, public persistStoreAs: IPersist = null as IPersist) {}

  private get isStoredStateItemUpdated () {
    return this.storedStateItem !== undefined;
  }

  private storedStateItem: IState | undefined = undefined;

  protected formatItemFromStore<T>(obj: T): any {
    return Object.keys(obj).filter((key) => !key.includes('_type')).reduce((acumulator, key) => {
      const type: string = obj[`${key}_type` as keyof T] as unknown as string;
      const unformatedValue = obj[key as keyof T];
      const isDateType = type === 'date';

      if (isDateType) {
        return {
          ...acumulator,
          [key]: new Date(unformatedValue as unknown as string),
        };
      }

      return {
        ...acumulator,
        [key]: isPrimitive(unformatedValue) ? unformatedValue : this.formatItemFromStore(unformatedValue),
      };
    }, {} as any);
  }

  protected formatToStore<T>(obj: T): any {
    return Object.keys(obj).reduce((acumulator, key) => {
      const value = obj[key as keyof T];
      const isDatetime = value instanceof Date;

      return ({
        ...acumulator,
        [key]: isPrimitive(value) || isDatetime ? value : this.formatToStore(value),
        [`${key}_type`]: isDatetime ? 'date' : typeof value,
      });
    }, {});
  }

  protected async getAsyncStoreItem(): Promise<IState> {
    if (this.isStoredStateItemUpdated) return this.storedStateItem as IState;

    const item = await asyncStorage.getItem(this.persistStoreAs as string);
    if (item) {
      const value = JSON.parse(item) as IState;
      const newState: IState = isPrimitive(value) ? value : this.formatItemFromStore(value);

      this.state = { ...this.state, ...newState };
    }

    this.setAsyncStoreItem();
    return this.state;
  }

  protected async setAsyncStoreItem(): Promise<void> {
    if (this.storedStateItem === this.state) return;

    this.storedStateItem = this.state;

    const valueToStore = isPrimitive(this.state) ? this.state : this.formatToStore(cloneDeep(this.state));

    await asyncStorage.setItem(this.persistStoreAs as string, JSON.stringify(valueToStore));
    await this.globalSetter(this.state);
  }

  public getPersistStoreValue = () => async (): Promise<IState> => this.getAsyncStoreItem();

  protected getStateCopy = (): IState => Object.freeze(cloneDeep(this.state));

  public getHook = <
    IApi extends IGlobalState.ActionCollectionResult<IActions> | null = IActions extends null ? null : IGlobalState.ActionCollectionResult<IActions>
  >() => (): [
    IPersist extends string ? () => Promise<IState> : IState,
    IGlobalState.IHookResult<IState, IsPersist, IActions, IApi>,
    IsPersist extends true ? IState : null,
    IsPersist extends true ? boolean : null,
  ] => {
    const [value, setter] = useState(this.state);
    const valueWrapper: (() => Promise<IState>) | IState = this.isPersistStore ? this.getPersistStoreValue() : value;

    useEffect(() => {
      this.subscribers.push(setter as IGlobalState.StateSetter<IState>);

      return () => {
        this.subscribers = this.subscribers.filter(x => setter !== x);
      };
    }, []);

    return [
      valueWrapper as IPersist extends string ? () => Promise<IState> : IState,
      this.stateOrchestrator as IGlobalState.IHookResult<IState, IsPersist, IActions, IApi>,
      this.state as IsPersist extends true ? IState : null,
      this.isStoredStateItemUpdated as IsPersist extends true ? boolean : null,
    ];
  };

  public getHookDecoupled = <
    IApi extends IGlobalState.ActionCollectionResult<IActions> | null = IActions extends null ? null : IGlobalState.ActionCollectionResult<IActions>
  >() => (): [
    () => IPersist extends string ? Promise<IState> : IState,
    IGlobalState.IHookResult<IState, IsPersist, IActions, IApi>,
    IsPersist extends true ? IState : null,
    IsPersist extends true ? boolean : null,
  ] => {
    const valueWrapper = this.isPersistStore ? this.getPersistStoreValue() : () => this.state;

    return [
      valueWrapper as () => IPersist extends string ? Promise<IState> : IState,
      this.stateOrchestrator as IGlobalState.IHookResult<IState, IsPersist, IActions, IApi>,
      this.state as IsPersist extends true ? IState : null,
      this.isStoredStateItemUpdated as IsPersist extends true ? boolean : null,
    ];
  };

  private _stateOrchestrator: IGlobalState.StateSetter<IState> | IGlobalState.ActionCollectionResult<IActions> | null = null;

  protected get stateOrchestrator(): IGlobalState.StateSetter<IState> | IGlobalState.ActionCollectionResult<IActions> {
    if (this._stateOrchestrator) return this._stateOrchestrator;

    if (this.actions) {
      this._stateOrchestrator = this.getActions() as IGlobalState.ActionCollectionResult<IActions>;
    } else if (this.persistStoreAs) {
      this._stateOrchestrator = this.globalSetterToPersistStore as IGlobalState.StateSetter<IState>;
    } else {
      this._stateOrchestrator = this.globalSetter as IGlobalState.StateSetter<IState>;
    }

    return this._stateOrchestrator as IGlobalState.StateSetter<IState> | IGlobalState.ActionCollectionResult<IActions>;
  }

  /**
  **  [subscriber-update-callback, hook, newState]
  */
  protected static batchedUpdates: [() => void, object, object][] = [];

  protected globalSetter = (setter: Partial<IState> | ((state: IState) => Partial<IState>), callback?: () => void) => {
    const partialState = typeof setter === 'function' ? setter(this.getStateCopy()) : setter;
    let newState = isPrimitive(partialState) ? partialState : { ...this.state, ...partialState };

    // avoid perform multiple update batches by accumulating state changes of the same hook
    GlobalStore.batchedUpdates = GlobalStore.batchedUpdates.filter(([, hook, previousState]) => {
      const isSameHook = hook === this;
      if (isSameHook) {
        // eslint-disable-next-line no-console
        console.warn('You should try avoid call the same state-setter multiple times at one execution line');
        newState = isPrimitive(newState) ? newState : { ...previousState, ...newState };
      }
      return !isSameHook;
    });

    this.state = newState as IState;

    // batch store updates
    GlobalStore.batchedUpdates.push([() => this.subscribers.forEach(updateChild => updateChild(newState)), this, newState]);

    GlobalStore.ExecutePendingBatches(callback);
  };

  protected globalSetterAsync = async (setter: Partial<IState> | ((state: IState) => Partial<IState>)): Promise<void> =>
    new Promise(resolve => this.globalSetter(setter, async () => resolve()));

  protected globalSetterToPersistStore = async (setter: Partial<IState> | ((state: IState) => Partial<IState>)): Promise<void> => {
    await this.globalSetterAsync(setter);
    await this.setAsyncStoreItem();
  };

  // avoid multiples calls to batchedUpdates
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static ExecutePendingBatches = debounce((callback: () => void = () => {}) => {
    const reactBatchedUpdates = ReactDOM.unstable_batchedUpdates || ((callback: () => void) => callback());

    reactBatchedUpdates(() => {
      GlobalStore.batchedUpdates.forEach(([callback]) => {
        callback();
      });
      GlobalStore.batchedUpdates = [];
    });

    callback();
  }, 0);

  protected getActions = <IApi extends IGlobalState.ActionCollectionResult<IGlobalState.IActionCollection<IState, IsPersist>>>(): IApi => {
    const actions = this.actions as IGlobalState.IActionCollection<IState, IsPersist>;
    // Setter is allways async because of the render batch
    // but we are typing the setter as synchronous to avoid the developer has extra complexity that useState do not handle
    const setter = this.isPersistStore ? this.globalSetterToPersistStore : this.globalSetterAsync;
    return Object.keys(actions).reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: (...parameres: unknown[]) => actions[key](...parameres)(setter as IGlobalState.StateSetter<IState, IsPersist>, this.getStateCopy()),
      }),
      {} as IApi,
    );
  };
}

export default GlobalStore;
