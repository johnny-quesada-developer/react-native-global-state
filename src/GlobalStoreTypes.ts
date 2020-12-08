export type StateSetter<IState, IsPersist extends boolean = false> = (
  setter: Partial<IState> | ((state: IState) => Partial<IState>),
) => IsPersist extends false ? void : Promise<void>;

/**
* This is the structure required by the API actions in order to be able to capture action parameters and inject state setter into actions.
*/
export type IAction<IState, IsPersist extends boolean = false> = <IResult>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...params: any[]
) => (setter: StateSetter<IState, IsPersist>, currentState: IState) => Promise<unknown> | IResult;

/**
* Configuration of you API
*/
export interface IActionCollection<IState, IsPersist extends boolean> {
  [key: string]: IAction<IState, IsPersist>;
}

/**
* This is the API result of the hook (if you passed an API as a parameter)
*/
export type ActionCollectionResult<IActions> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key in keyof IActions]: <IResult>(...params: any[]) => any | IResult;
};

/**
* Hook result, if you passed an API as a parameter it will be returned in the second position of the hook invoke.
*/
export type IHookResult<
  IState,
  IsPersist extends boolean,
  IActions extends IActionCollection<IState, IsPersist> | null = null,
  IApi extends ActionCollectionResult<IActions> | null = IActions extends null ? null : ActionCollectionResult<IActions>
> = IApi extends null
  ? StateSetter<IState, IsPersist>
  : IActions extends IActionCollection<IState, IsPersist>
  ? IApi extends ActionCollectionResult<IActions>
    ? IApi
    : StateSetter<IState, IsPersist>
  : StateSetter<IState, IsPersist>;

  /**
* This is a class to create global-store objects
* @template IState
* @param {IState} state - Initial state,
* @template IPersist
* @param {IPersist} persistStoreAs -  A name that indicates if the store should be persisted at the asyncStorage 
* @template IsPersist
* @param {IsPersist} isPersist - Calculated flag that indicates if the store is persisted
* @template IActions
* @param {IActions} actions - An specific api to restrict the use of the state,
* this will disable the default return of the state-setter of the hook, and instead will return the API
* @param {string} persistStoreAs - A name if you want to persist the state of the store in localstorage
* */
  export interface IGlobalStateFactory<
  IState,
  IPersist extends string | null = null,
  IsPersist extends boolean = IPersist extends null ? false : true,
  IActions extends IActionCollection<IState, IsPersist> | null = null
> {
  /**
  * Returns a global hook that will share information across components by subscribing them to a specific store.
  * @return [currentState, GlobalState.IHookResult<IState, IActions, IApi>]
  */
  getHook: <IApi extends IActions extends ActionCollectionResult<IActions> ? ActionCollectionResult<IActions> : null>() => () => [
    IPersist extends string ? () => Promise<IState> : IState,
    IHookResult<IState, IsPersist, IActions, IApi>,
    IsPersist extends true ? IState : null,
  ];

  /**
  * This is an access to the subscribers queue and to the current state of a specific store...
  * THIS IS NOT A REACT-HOOK, so you could use it everywhere example other hooks, and services.
  * @return [currentState, GlobalState.IHookResult<IState, IsPersist, IActions, IApi>]
  */
  getHookDecoupled: <IApi extends IActions extends ActionCollectionResult<IActions> ? ActionCollectionResult<IActions> : null>() => () => [
    () => IPersist extends string ? Promise<IState> : IState,
    IHookResult<IState, IsPersist, IActions, IApi>,
    IsPersist extends true ? IState : null,
  ];
}