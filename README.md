# @atomico/custom-elements-manifest

plugin for [@custom-elements-manifest/analyzer](https://github.com/open-wc/custom-elements-manifest/) that adds support to [Atomico](https://github.com/atomicojs/atomico)

## Installation

```bash
npm install @atomico/custom-elements-manifest
```

## Example

`custom-elements-manifest.config.mjs`

```js
import atomico from "@atomico/custom-elements-manifest";

export default {
    plugins: [atomico()],
};
```

## Supported Syntax

This plugin supports the new Atomico component syntax with inline `c()` calls:

```ts
import { c } from "atomico";

/**
 * Description of my component
 * @cssprop {color} --text-color - Controls the text color
 * @slot default - Default slot content
 */
export const MyComponent = c(
    ({ name, age }) => <host>Hello, {name}!</host>,
    {
        props: {
            /**
             * User's name
             */
            name: String,
            /**
             * User's age
             */
            age: Number,
        },
    }
);

customElements.define("my-component", MyComponent);
```

### Extended Props Configuration

You can also use extended prop configurations with attributes and events:

```ts
export const MyComponent = c(
    ({ value }) => <host>{value}</host>,
    {
        props: {
            value: {
                type: Array,
                attr: "custom-attr-name",
                /**
                 * Fired when value changes
                 */
                event: {
                    type: "ValueChanged",
                    base: "CustomEvent"
                },
            },
        },
    }
);
```

### Events and Methods via Host Generic Type

You can define events and methods using the `Host` generic type parameter on the component function's return type:

```ts
export const MyComponent = c(
    ({ name }): Host<{
        onMyCustomEvent: Event;
        onValueChanged: CustomEvent<string>;
        doSomething: () => void;
        getValue: () => string;
    }> => {
        return <host>Hello, {name}!</host>;
    },
    {
        props: {
            name: String,
        },
    }
);
```

**Event Naming Convention:**
- Properties starting with `on` are treated as events
- The event name is everything after the `on` prefix (e.g., `onMyCustomEvent` → `MyCustomEvent`)
- The TypeScript type is captured (e.g., `Event`, `CustomEvent`)

**Methods:**
- Properties not starting with `on` are treated as methods
- Both the method name is captured in the manifest

### Sharing Props with Spread Syntax

You can share common props between components by spreading imported prop objects:

```ts
// base-props.ts
export const baseProps = {
    id: String,
    name: String,
    disabled: Boolean,
};

// my-component.ts
import { c } from "atomico";
import { baseProps } from "./base-props";

export const MyComponent = c(
    ({ id, name, disabled, customProp }) => <host>...</host>,
    {
        props: {
            ...baseProps,
            customProp: Number,
        },
    }
);
```

The spread props will be resolved and included in the component's manifest. Props defined directly in the component can override spread props if they have the same name.

You can also use imported prop objects directly without spreading:

```ts
// Using direct reference
export const MyComponent = c(
    ({ id, name }) => <host>...</host>,
    {
        props: baseProps,  // Direct reference
    }
);

// Using shorthand syntax
import { baseProps as props } from "./base-props";

export const MyComponent = c(
    ({ id, name }) => <host>...</host>,
    { props }  // Shorthand for { props: props }
);
```
