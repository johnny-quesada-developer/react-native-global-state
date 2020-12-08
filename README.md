# react-native-global-state
This is a package to easily handling global-state across your react-native-components No-redux, No-context.

This utility follows the same style as the default useState hook, this in order to be an intuitive tool to help you to quickly migrate from complex options as redux to the new react-hooks.

## Creating a global store, an a simple hook

We are gonna create a global count example **count.ts**:

```
import GlobalStore from 'react-native-global-state';

const countStore = new GlobalStore(0);

export const useCount = countStore.getHook();
```

That's it, that's a global store... Strongly typed, with a global-hook that we could reuse cross all our react-components.

## Consuming global hook
Let's say we have two components stage1, stage2, in order to use our global hook they will look just like: 
```
import { useCount } from './count'

function Stage1() {
  const [count, setter] = useCount();
  const onClick = useCallback(() => setter(currentState => currentState + 1), []);
  return (<button onPress={onClick}>count: {count}<button/>);
}

function Stage2() {
  const [count, setter] = useCount();
  const onClick = useCallback(() => setter(currentState => currentState + 1));
  return (<button onPress={onClick}>count: {count}<button/>);
}
```
Just like that, you are using a global state. Note that the only difference between this and the default useState hook is that you are not adding the initial value, cause you already did that when you created the store. 

## Persisted store

You could persist the state in the local-storage by just adding a name to the constructor of your global-store let's see.
```
const countStore = new GlobalStore(0, null, 'GLOBAL_COUNT');
```

## Creating hooks with reusable actions

Let's say you want to have a STATE with a specific set of actions that you could reuse. With this library is pretty easy to accomplish. Let's create **plus** and **decrease** actions to our COUNT-store. **count.ts**:

```
import * as IGlobalState from 'react-native-global-state/lib/GlobalStoreTypes';
import GlobalStore from 'react-native-global-state';

const countStore = new GlobalStore(0, {
  plus: (increase: number) => async (setter: IGlobalStore.StateSetter<number>, currentState: number) => {
    // perfom whatever login you want
    setter(currentState + increase);
  },
  decrease: (decrease: number) => async (setter: IGlobalStore.StateSetter<number>, currentState: number) => {
    // perfom whatever login you want
    setter(currentState - decrease);
  },
}, 'GLOBAL_COUNT');

export const useCount = countStore.getHook();

```

Now the result of our useCount will return our actions instead of a simple setter... Let's see:

```
import { useCount } from './count'

function Stage1() {
  const [count, actions] = useCount();
  const increaseClick = useCallback(() => actions.plus(1), []);
  const decreaseClick = useCallback(() => actions.decrease(1), []);

  return (<>
      <label>{count}<label/><br/>
      <button onPress={increaseClick}>increase<button/>
      <button onPress={decreaseClick}>decrease<button/>
    </>);
}

```

You could also type the API contract, in order to take more advantage of typescript, just by passing an interface to getHook method:

```
export interface ICountActions {
  plus: (increase: number) => Promise<void>,
  decrease: (decrease: number) => Promise<void>,
}

export const useCount = countStore.getHook<ICountActions>();
```
The above step is necessary to get the correct typing of the parameters of your actions. The above step is necessary to get the correct typing of the parameters of your actions, otherwise, you'll get the name of the actions but the parameters would be all TYPE-ANY

## Decoupled hook

Finally, if you want to access the global state outside a component, or without subscribing the component to the state changes... 

This is especially useful when you want to reuse an action into another one, or when you wrote components that have edition access to a certain store, but they actually don't need to be reactive to the state changes, like a search component that just need to get the current state every time is gonna search the data, but actually don't need to hear all changes over the collection he is gonna be filtering. 
```
export const useCount = countStore.getHook<ICountActions>();
export const useCountDecoupled = countStore.getHookDecoupled<ICountActions>();
```

Let's see a trivial example: 
```
import { useCount, useCountDecoupled } from './count'

function Stage1() {
  const [count] = useCount();

  return (<label>{count}<label/><br/>);
}

function Stage2() {
  const [, actions] = useCountDecoupled();
  const increaseClick = useCallback(() => actions.plus(1), []);
  const decreaseClick = useCallback(() => actions.decrease(1), []);

  return (<>
      <button onPress={increaseClick}>increase<button/>
      <button onPress={decreaseClick}>decrease<button/>
    </>);
}
```

Now our stage 1, is just listening to the changes of the state, while stage 2 is just acting as an orchestrator, but stage 2 is not actively listening to state changes, so, actually is not gonna be re-render while stage 1 does. 

# Important notes:
Are concern about performance? this library is for you, instead of handling huge complex stores with options like redux, or by passing the setState to a context Provider (because of the limitations that the context has)... If does, You should just use this library, we are using the more atomic and 'native' way that REACT gives to handle the state, and that is the hook **useState**... 

This utility is just including the implementation of the use state into a subscriber pattern, to enable you to create hooks that will be subscribed to specific store changes, does how we'll be creating a global state hook. 

## Advantages:
1. Using REACT's simplest and default way to deal with the state.
2. Adding partial state designations (This is not on useState default functionality)
3. Added availability to create actions and decoupled access to the states, no more connects, and dispatches, just call your actions as a normal service of whatever other libraries.
4. This library is already taking care of avoiding re-renders if the new state does not have changes
5. This library also is taking care of batching multiple stores updates by using **React unstable_batchedUpdates**; this is a problem that the **useState** have when you call multiple **setStates** into async flows as setTimeout
6. This tool also take care for you to avoid localStorage data to lose the data types that you stored. For example when you are using datetimes
