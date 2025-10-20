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
